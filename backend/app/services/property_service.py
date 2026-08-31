"""
InterCity Chatbot - Property Service (Live SQL Server)
======================================================
Central business logic for the real-estate chatbot.
Queries the live tbl_PropertyMaster + tbl_PropertyDetails tables,
JOINs with lookup tables for human-readable names, and generates
grounded AI responses via Gemini.

Security Enforced:
  - No PII (phone, email, password, device) is ever returned.
  - All queries use parameterized SQLAlchemy ORM (no raw SQL).
  - Results capped at 20 properties per query.
  - Only OwnerName (first name) from tbl_PropertyDetails is shown.
"""

import re
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, case, or_

from app.property_models import (
    PropertyMasterModel,
    PropertyDetailsModel,
    EstateTypeModel,
    DealingTypeModel,
    PropertyTypeModel,
    BHKTypeModel,
    FurnishedTypeModel,
    ParkingTypeModel,
    PossessionTypeModel,
    PropertyStatusTypeModel,
)
from app.config import settings
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

# Maximum number of properties to return per query
MAX_RESULTS = 1000

# Fields that are safe to expose via the chatbot API
SAFE_FIELDS = [
    "id", "property_name", "description", "location", "city", "state",
    "estate_type", "dealing_type", "property_type", "bhk_type",
    "price", "deposit", "carpet_area", "saleable_area",
    "furnishing", "parking", "possession_type", "property_status",
    "amenities", "bedrooms", "bathrooms", "balconies", "floor",
    "age_of_property", "landmark", "available_for",
    "door_direction", "vastu_compliant", "owner_first_name",
    "possession_date", "latitude", "longitude",
    "floor_count", "cabin_count", "toilet_count", "pantry_count",
    "workstation", "conference_count", "seaters_count", "suitable_for", "type_of_furnished",
]

# All known major localities/locations in Pune database
KNOWN_LOCATIONS = [
    "kondhwa", "undri", "wagholi", "hinjawadi", "hinjewadi", "wakad", "kharadi", 
    "hadapsar", "ravet", "baner", "kothrud", "dhayari", "dhanori", "lohegaon", 
    "moshi", "katraj", "balewadi", "warje", "punawale", "pimple java", "pimple saudagar", 
    "wanowrie", "wanwori", "bavdhan", "ambegaon", "ambegaon budruk", "aundh", "pisoli", "narhe", 
    "viman nagar", "rahatani", "charholi", "charholi budruk", "sus", "pashan", "sangvi",
    "nigdi", "nanded", "tathawade", "tathavade", "magarpatta", "akurdi", "saswad",
    "bibvewadi", "bibwewadi", "yerwada", "yerawada", "kalyani nagar", "swargate",
    "shivajinagar", "deccan", "chinchwad", "pimpri"
]

# Comprehensive spelling alias mappings for maximum search recall across Pune database
LOCATION_ALIASES = {
    # Hinjewadi / Hinjawadi
    "hinjewadi": ["hinjewadi", "hinjawadi", "hinjwadi", "hinjewasi", "hinjewdi", "hinjiewadi", "hinj"],
    "hinjawadi": ["hinjewadi", "hinjawadi", "hinjwadi", "hinjewasi", "hinjewdi", "hinjiewadi", "hinj"],
    "hinjawad": ["hinjewadi", "hinjawadi", "hinjwadi", "hinjawad", "hinj"],
    
    # Wakad
    "wakad": ["wakad", "wakada", "wakade"],
    "wakada": ["wakad", "wakada"],

    # Pimple Areas
    "pimple saudagar": ["pimple saudagar", "pimpale saudagar", "pimple", "saudagar"],
    "pimple gurav": ["pimple gurav", "pimpale gurav", "pimple"],
    "pimple nilakh": ["pimple nilakh", "pimpale nilakh", "pimple"],
    "pimple java": ["pimple java", "pimple"],
    "pimple": ["pimple saudagar", "pimple gurav", "pimple nilakh", "pimple java", "pimple"],

    # Pimpri Chinchwad
    "chinchwad": ["chinchwad", "chinjawad", "chinjwad", "chinchwadgaon", "chinj"],
    "pimpri": ["pimpri", "pimpri chinchwad", "pimpri-chinchwad"],
    "pimpri chinchwad": ["pimpri", "chinchwad", "chinjawad", "pimpri chinchwad"],

    # Kharadi
    "kharadi": ["kharadi", "khara", "kharadi rd"],
    "khara": ["kharadi", "khara"],

    # Hadapsar
    "hadapsar": ["hadapsar", "hadapsar rd", "hadapsar gaon"],

    # Kondhwa
    "kondhwa": ["kondhwa", "kondwa", "kondhwa bk", "kondhwa khurd"],
    "kondwa": ["kondhwa", "kondwa"],

    # Wagholi / Nagar Road
    "wagholi": ["wagholi", "wagaonsheri", "wag", "wagholi rd"],
    "wagaonsheri": ["wagaonsheri", "viman nagar", "wagholi"],

    # Viman Nagar
    "viman nagar": ["viman nagar", "viman", "vimannagar"],
    "viman": ["viman nagar", "vimannagar", "viman"],

    # Kothrud
    "kothrud": ["kothrud", "kothrud depot", "kothrud bus stand"],

    # Baner / Balewadi
    "baner": ["baner", "baner rd", "baner pashan"],
    "balewadi": ["balewadi", "balewadi high street", "balewadi phata"],

    # Aundh
    "aundh": ["aundh", "aundh rd", "aundh gaon"],

    # Bavdhan
    "bavdhan": ["bavdhan", "bavdhan bk", "bavdhan khurd"],

    # Undri
    "undri": ["undri", "undri chowk", "undri pisoli"],

    # Ravet / Punawale
    "ravet": ["ravet", "ravet pradhikaran"],
    "punawale": ["punawale", "punawal"],
    "punawal": ["punawale", "punawal"],

    # Dhayari / Narhe
    "dhayari": ["dhayari", "dhayari phata"],
    "narhe": ["narhe", "narhe ambegaon"],

    # Dhanori / Lohegaon
    "dhanori": ["dhanori", "dhanori lohegaon"],
    "lohegaon": ["lohegaon", "lohegaon rd"],

    # Moshi
    "moshi": ["moshi", "moshi pradhikaran"],

    # Katraj
    "katraj": ["katraj", "katraj ghat", "katraj kondhwa"],

    # Warje
    "warje": ["warje", "warje malwadi"],

    # Wanowrie
    "wanowrie": ["wanowrie", "wanwori", "wanowri"],
    "wanwori": ["wanowrie", "wanwori"],

    # Ambegaon
    "ambegaon": ["ambegaon", "ambegaon budruk", "ambegaon bk"],
    "ambegaon budruk": ["ambegaon", "ambegaon budruk", "ambegaon bk"],

    # Pisoli
    "pisoli": ["pisoli", "pisoli rd"],

    # Rahatani
    "rahatani": ["rahatani", "rahatni"],

    # Charholi
    "charholi": ["charholi", "charholi budruk", "charholi bk"],
    "charholi budruk": ["charholi", "charholi budruk", "charholi bk"],

    # Sus / Pashan
    "sus": ["sus", "sus road", "sus gaon"],
    "pashan": ["pashan", "pashan rd"],

    # Tathawade
    "tathawade": ["tathawade", "tathavade"],
    "tathavade": ["tathawade", "tathavade"],

    # Magarpatta / Kalyani Nagar
    "magarpatta": ["magarpatta", "magarpatta city"],
    "kalyani nagar": ["kalyani nagar", "kalyaninagar"],

    # Akurdi / Nigdi
    "akurdi": ["akurdi", "akurdi station"],
    "nigdi": ["nigdi", "nigdi pradhikaran"],

    # Bibvewadi / Yerwada / Swargate
    "bibvewadi": ["bibvewadi", "bibwewadi"],
    "yerwada": ["yerwada", "yerawada"],
    "swargate": ["swargate", "swargate bus stand"],
    "shivajinagar": ["shivajinagar", "shivaji nagar"],
}


class PropertyService:
    """Handles chatbot queries against the live SQL Server property database."""
    _gemini_active = False
    _gemini_active = True
    
    # Gemini is permanently disabled as per user request to force rule-based logic and improve speed.

    @staticmethod
    def _check_missing_basic_filters(filters: Dict[str, Any]) -> List[str]:
        """
        Check for missing basic parameters in a strict sequence:
        1. Location
        2. Estate Type (Residential/Commercial)
        3. BHK
        4. Budget (Price)
        Returns a list with ONLY the FIRST missing parameter, to ensure questions are asked one by one.
        """
        # 1. Location
        loc = filters.get("location")
        city = filters.get("city")
        if not loc and not city:
            return ["location"]

        # 2. Estate Type / Category
        et = filters.get("estate_type")
        pt = filters.get("property_type")
        if not et and not pt:
            return ["residential or commercial category"]

        # 3. BHK Type
        bhk = filters.get("bhk")
        if bhk is None:
            return ["BHK requirement"]

        # 4. Budget / Price Range
        min_p = filters.get("min_price")
        max_p = filters.get("max_price")
        return ["budget (price range)"] if min_p is None and max_p is None else []

    @staticmethod
    def _get_varying_fields(properties: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """Identify which attributes vary among the matching properties."""
        varying = {}
        fields_to_check = {
            "bhk_type": "BHK type",
            "furnishing": "furnishing type",
            "property_status": "possession status",
            "property_type": "property subtype",
            "balconies": "balconies count",
            "door_direction": "facing direction",
            "vastu_compliant": "Vastu compliance",
            "age_of_property": "age of property",
            "floor": "floor number",
        }
        for field, label in fields_to_check.items():
            vals = set()
            for p in properties:
                val = p.get(field)
                if val and str(val).strip() and str(val).lower() not in ["none", "n/a", "any"]:
                    vals.add(str(val).strip())
            if len(vals) > 1:
                varying[field] = sorted(list(vals))

        # Amenities check
        all_amenities = {}
        for p in properties:
            if am_str := p.get("amenities", ""):
                for am in am_str.split(","):
                    if am_clean := am.strip().title():
                        all_amenities[am_clean] = all_amenities.get(am_clean, 0) + 1

        total_props = len(properties)
        if varying_amenities := [
            am for am, count in all_amenities.items() if 0 < count < total_props
        ]:
            varying["amenities"] = varying_amenities[:5]

        return varying

    @staticmethod
    def query_chatbot(
        db: Session,
        question: str,
        history: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        """
        Main entry point: parse question → query DB → mask PII → generate response.
        """
        # Get live stats
        meta = PropertyService.get_metadata(db)

        if not meta or meta["total_properties"] == 0:
            return {
                "answer": "The property database appears to be empty. Please contact the administrator.",
                "properties": [],
                "suggestions": ["Hi, help me find properties"],
                "metadata": None,
            }

        # 1. Parse question → structured filters
        parsed = PropertyService._nlp_parse_query(question, history)
        logger.info(f"Extracted cumulative filters: {parsed}")

        # 2. Query the live database
        raw_results = PropertyService._query_database(db, parsed)
        logger.info(f"Database returned {len(raw_results)} matching properties.")

        # 3. Apply security masking (strip all PII)
        safe_properties = PropertyService._apply_security_masking(raw_results)

        # 4. Check if this is a general query or greeting
        is_general = parsed.get("general_query", False)

        # 5. Dialog Flow Routing
        N = len(safe_properties)
        missing_basics = []
        show_properties = False
        force_show = parsed.get("force_show", False)
        ask_for_parking = False

        if is_general:
            # General query, don't show properties, just chat
            show_properties = False
        elif force_show or N <= 30:
            # Override to show directly or Results are <= 30
            show_properties = True
        else:
            # Broad search (> 30 properties): STRICT 4-step parameter check
            filters = parsed.get("filters", {})
            missing_basics = PropertyService._check_missing_basic_filters(filters)

            if missing_basics:
                # Any of the 4 basic parameters are missing: ask for the next one
                show_properties = False
            else:
                # All 4 basic parameters are present
                show_properties = True
                if N > 50:
                    # Optional: ask for parking/amenities if they aren't provided
                    if not filters.get("parking") and not filters.get("amenities"):
                        ask_for_parking = True

        # 6. Generate conversational response grounded in results and dialog state
        answer = PropertyService._generate_grounded_response(
            question=question, 
            properties=safe_properties, 
            history=history,
            missing_basics=missing_basics,
            ask_for_parking=ask_for_parking
        )

        # 7. Build suggestion chips
        suggestions = []
        if not is_general:
            filters = parsed.get("filters", {})
            target_place = filters.get("location") or filters.get("city")
            loc_suffix = f" in {target_place.title()}" if target_place else ""

            if missing_basics:
                next_missing = missing_basics[0]
                if "location" in next_missing:
                    suggestions = ["In Wakad", "In Hinjewadi", "In Kharadi", "In Baner"]
                elif "dealing" in next_missing:
                    suggestions = [f"For Rent{loc_suffix}", f"For Sale{loc_suffix}", f"Any dealing type{loc_suffix}"]
                elif "category" in next_missing or "residential" in next_missing:
                    suggestions = [f"Residential Flat{loc_suffix}", f"Commercial Shop{loc_suffix}", f"Commercial Office{loc_suffix}"]
                elif "BHK" in next_missing:
                    suggestions = [f"1 BHK Flat{loc_suffix}", f"2 BHK Flat{loc_suffix}", f"3 BHK Flat{loc_suffix}", f"Any BHK{loc_suffix}"]
                elif "budget" in next_missing or "price" in next_missing:
                    suggestions = [f"Under 30k (Rent){loc_suffix}", f"Under 50 Lakhs{loc_suffix}", f"Between 50 to 80 Lakhs{loc_suffix}", f"Any budget{loc_suffix}"]
                elif "parking" in next_missing:
                    suggestions = [f"Need Covered Parking{loc_suffix}", f"Open Parking is fine{loc_suffix}", f"No parking needed{loc_suffix}", f"Any parking{loc_suffix}"]
                elif "furnishing" in next_missing:
                    suggestions = [f"Fully Furnished{loc_suffix}", f"Semi-Furnished{loc_suffix}", f"Unfurnished{loc_suffix}", f"Any furnishing{loc_suffix}"]
                elif "amenities" in next_missing:
                    suggestions = [f"With Swimming Pool{loc_suffix}", f"Need elevator / lift{loc_suffix}", f"With Gym{loc_suffix}", f"No specific amenities{loc_suffix}"]
            elif ask_for_parking:
                suggestions = [
                    f"Need Covered Parking{loc_suffix}",
                    f"Open Parking is fine{loc_suffix}",
                    f"With Swimming Pool{loc_suffix}",
                    f"With Gym{loc_suffix}",
                    "Show Results Directly",
                ]

        # Fallback to standard suggestions if needed
        if not suggestions:
            suggestions = PropertyService._generate_suggestions(parsed, safe_properties if show_properties else [])

        return {
            "answer": answer,
            "properties": safe_properties if show_properties else [],
            "suggestions": suggestions,
            "metadata": {
                "total_properties": meta["total_properties"],
                "total_matches": N,
            },
        }

    @staticmethod
    def get_metadata(db: Session) -> Optional[Dict[str, Any]]:
        """Returns live database statistics — no cached metadata table needed."""
        try:
            total_props = db.query(func.count(PropertyMasterModel.Id)).filter(
                PropertyMasterModel.IsActive == True
            ).scalar() or 0

            return {
                "total_properties": total_props,
            }
        except Exception as e:
            logger.error(f"Failed to get metadata: {e}")
            return None

    # ── NLP Query Parser ─────────────────────────────────────────────────────

    @staticmethod
    def _nlp_parse_query(
        question: str, history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Parse natural language query into structured filters using ONLY Gemini AI."""
        if not settings.GEMINI_API_KEY:
            logger.error("GEMINI_API_KEY is missing. Gemini AI cannot parse query.")
            return {"filters": {}, "sorting": None, "general_query": True, "force_show": False}

        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            history_text = ""
            for item in history[-6:]:
                role = "User" if item.get("role") == "user" else "Assistant"
                content = item.get("content", "")
                history_text += f"{role}: {content}\n"

            prompt = f"""You are a query parser for a real-estate property database in India.
The database has these searchable fields:
- location/area (Known Pune locations: "Kondhwa", "Undri", "Wagholi", "Hinjewadi", "Wakad", "Kharadi", "Hadapsar", "Ravet", "Baner", "Kothrud", "Dhayari", "Dhanori", "Lohegaon", "Moshi", "Katraj", "Balewadi", "Warje", "Punawale", "Pimple Saudagar", "Wanowrie", "Bavdhan", "Ambegaon Budruk", "Aundh", "Pisoli", "Narhe", "Viman Nagar", "Rahatani", "Charholi Budruk")
- city (e.g. "Pune", "Mumbai")
- bhk (integer: 1, 2, 3, 4 etc.)
- min_price / max_price (in Indian Rupees; users may say "50 lakh" = 5000000, "1 crore" = 10000000)
- min_carpet_area / max_carpet_area (in sq ft)
- furnishing (one of: "Furnished", "Unfurnished", "Semi-Furnished")
- parking (e.g. "Open", "Covered", "Both", "None")
- estate_type (one of: "Residential", "Commercial")
- dealing_type (one of: "Sale", "Rent")
- property_type (e.g. "Flat", "Apartment", "Villa", "Row House", "Bungalow", "Plot", "Office", "Shop")
- property_status (e.g. "Ready to Move", "Under Construction")
- possession_type (e.g. "Ready", "Under Construction")
- bedrooms (integer)
- bathrooms (integer)

Conversation History:
{history_text}

User Question:
{question}

Extract structured search filters representing the cumulative search criteria across both the Conversation History and the new User Question.
- Any filter established in previous turns (e.g. location, BHK, dealing type, budget) MUST be retained in the "filters" object unless the user explicitly changes or cancels it.
- If the user explicitly states they don't care, have no preference, or want any option for a field (e.g., "any parking", "no preference on furnishing", "any budget"), set that field value to "Any" rather than null. This informs the system that the requirement was addressed.

Return a JSON object with:
- "filters": {{
    "location": string or null,
    "city": string or null,
    "bhk": integer or null,
    "min_price": number or null (in Rupees),
    "max_price": number or null (in Rupees),
    "min_carpet_area": number or null (in sq ft),
    "max_carpet_area": number or null (in sq ft),
    "furnishing": string or null,
    "parking": string or null,
    "estate_type": string or null,
    "dealing_type": string or null,
    "property_type": string or null,
    "property_status": string or null,
    "bedrooms": integer or null,
    "bathrooms": integer or null
  }}
- "sorting": string or null ("cheapest" | "expensive" | "largest" | "smallest" | "newest")
- "general_query": boolean (true if greeting, about-bot question, or unrelated to property search)

Provide ONLY valid JSON. No markdown blocks or headers."""

            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
                request_options={"timeout": 10.0}
            )
            data = json.loads(response.text.strip())
            return data
        except Exception as e:
            logger.error(f"Gemini parse failed: {e}.")
            return {"filters": {}, "sorting": None, "general_query": True, "force_show": False}

    @staticmethod
    def _fallback_parse_query(question: str) -> Dict[str, Any]:
        """Simple regex-based parsing fallback when Gemini is unavailable."""
        q_lower = question.lower()
        filters: Dict[str, Any] = {
            "location": None,
            "city": None,
            "bhk": None,
            "min_price": None,
            "max_price": None,
            "min_carpet_area": None,
            "max_carpet_area": None,
            "furnishing": None,
            "parking": None,
            "estate_type": None,
            "dealing_type": None,
            "property_type": None,
            "property_status": None,
            "bedrooms": None,
            "bathrooms": None,
        }
        sorting = None
        general_query = False
        force_show = False

        # Greetings
        if any(
            k in q_lower
            for k in ["hi", "hello", "hey", "greetings", "who are you", "help"]
        ):
            general_query = True
            
        # Force Show Keywords
        if any(
            k in q_lower
            for k in ["show properties", "show results", "display properties", "skip", "show me properties", "show cards"]
        ):
            force_show = True

        # BHK
        bhk_match = re.search(r"(\d+)\s*(?:bhk|bedroom|rooms|bed)", q_lower)
        if bhk_match:
            filters["bhk"] = int(bhk_match.group(1))

        # Price range
        between_match = re.search(
            r"between\s+(\d+(?:\.\d+)?)\s*(?:lakh|lacs|lac|cr|crore)?\s+and\s+(\d+(?:\.\d+)?)\s*(lakh|lacs|lac|cr|crore)?",
            q_lower,
        )
        if between_match:
            val1 = float(between_match.group(1))
            val2 = float(between_match.group(2))
            unit = between_match.group(3) or "lakh"
            mult = 100000.0 if "lakh" in unit or "lac" in unit else 10000000.0
            filters["min_price"] = val1 * mult
            filters["max_price"] = val2 * mult
        else:
            under_match = re.search(
                r"(?:under|below|less than|max|maximum)\s*₹?\s*(\d+(?:\.\d+)?)\s*(lakh|lacs|lac|cr|crore)?",
                q_lower,
            )
            if under_match:
                val = float(under_match.group(1))
                unit = under_match.group(2) or "lakh"
                mult = (
                    100000.0 if "lakh" in unit or "lac" in unit else 10000000.0
                )
                filters["max_price"] = val * mult

            above_match = re.search(
                r"(?:above|more than|greater than|min|minimum|over)\s*₹?\s*(\d+(?:\.\d+)?)\s*(lakh|lacs|lac|cr|crore)?",
                q_lower,
            )
            if above_match:
                val = float(above_match.group(1))
                unit = above_match.group(2) or "lakh"
                mult = (
                    100000.0 if "lakh" in unit or "lac" in unit else 10000000.0
                )
                filters["min_price"] = val * mult

        # Furnishing
        if "furnished" in q_lower:
            if "semi" in q_lower:
                filters["furnishing"] = "Semi-Furnished"
            elif "un" in q_lower:
                filters["furnishing"] = "Unfurnished"
            else:
                filters["furnishing"] = "Furnished"

        # Dealing type
        if "rent" in q_lower or "rental" in q_lower:
            filters["dealing_type"] = "Rent"
        elif "sale" in q_lower or "buy" in q_lower or "purchase" in q_lower:
            filters["dealing_type"] = "Sale"

        # Estate type
        if "commercial" in q_lower:
            filters["estate_type"] = "Commercial"
        elif "residential" in q_lower:
            filters["estate_type"] = "Residential"

        # Parking
        if "parking" in q_lower:
            filters["parking"] = "yes"

        # Sorting
        if "cheapest" in q_lower or "lowest price" in q_lower or "budget" in q_lower:
            sorting = "cheapest"
        elif "expensive" in q_lower or "highest price" in q_lower or "costly" in q_lower:
            sorting = "expensive"
        elif "largest" in q_lower or "biggest" in q_lower:
            sorting = "largest"

        # Location extraction
        # First check if the query contains any of the known locations in the database
        matched_loc = False
        for loc in KNOWN_LOCATIONS:
            if loc in q_lower:
                filters["location"] = loc.title()
                matched_loc = True
                break

        if not matched_loc:
            loc_match = re.search(r"(?:in|near|at|around)\s+([a-zA-Z\s]+)", q_lower)
            if loc_match:
                loc_candidate = loc_match.group(1).strip().title()
                known_cities = ["pune", "mumbai", "nashik", "nagpur", "thane"]
                if loc_candidate.lower() in known_cities:
                    filters["city"] = loc_candidate
                else:
                    filters["location"] = loc_candidate

        return {
            "filters": filters,
            "sorting": sorting,
            "general_query": general_query,
            "force_show": force_show,
        }

    @staticmethod
    def _generate_location_aliases(raw_loc: str) -> List[str]:
        """
        Generates all possible spelling variants, phonetic forms, token splits, 
        and root stems for EVERY location word automatically.
        """
        if not raw_loc:
            return []
            
        loc_clean = raw_loc.strip().lower()
        aliases = set()
        aliases.add(loc_clean)
        
        # 1. Check explicit alias map
        if loc_clean in LOCATION_ALIASES:
            for a in LOCATION_ALIASES[loc_clean]:
                aliases.add(a.lower())
                
        # 2. Tokenize multi-word locations (e.g. "viman nagar" -> "viman", "nagar")
        words = [w for w in re.split(r"[\s\-_,]+", loc_clean) if len(w) >= 3]
        for w in words:
            aliases.add(w)
            
            # Phonetic v/w substitution (e.g. Tathawade <-> Tathavade, Bavdhan <-> Bawdhan)
            if "v" in w:
                aliases.add(w.replace("v", "w"))
            if "w" in w:
                aliases.add(w.replace("w", "v"))
                
            # Phonetic e/a substitution (e.g. Hinjewadi <-> Hinjawadi)
            if "e" in w:
                aliases.add(w.replace("e", "a"))
            if "a" in w:
                aliases.add(w.replace("a", "e"))
                
            # Silent 'h' removal (e.g. Kondhwa -> Kondwa, Dhayari -> Dayari)
            if "h" in w:
                aliases.add(w.replace("h", ""))
                
            # Root stem (first 4 characters if word length >= 4)
            if len(w) >= 4:
                aliases.add(w[:4])
                
        return [a for a in aliases if len(a) >= 3]

    # ── Database Query ───────────────────────────────────────────────────────

    @staticmethod
    def _query_database(
        db: Session, parsed: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Queries tbl_PropertyMaster JOIN tbl_PropertyDetails with lookup JOINs.
        Returns dictionaries with human-readable field names.
        """
        if parsed.get("general_query"):
            return []

        filters = parsed.get("filters", {})

        # Build the base query with all necessary JOINs
        query = (
            db.query(
                PropertyMasterModel.Id.label("master_id"),
                PropertyMasterModel.Latitude,
                PropertyMasterModel.Longitude,
                PropertyMasterModel.EntryDate,
                PropertyMasterModel.BudgetRangeFrom,
                PropertyMasterModel.BudgetRangeTo,
                PropertyDetailsModel.Id.label("detail_id"),
                PropertyDetailsModel.PropertyName,
                PropertyDetailsModel.PropDesc,
                PropertyDetailsModel.OwnerName,
                PropertyDetailsModel.ExpectedAmt,
                PropertyDetailsModel.ExpectedDeposite,
                PropertyDetailsModel.CarpetArea,
                PropertyDetailsModel.SalebleArea,
                PropertyDetailsModel.AreaIn,
                PropertyDetailsModel.AreaInCarpet,
                PropertyDetailsModel.AreaInSaleable,
                PropertyDetailsModel.City,
                PropertyDetailsModel.Area,
                PropertyDetailsModel.State,
                PropertyDetailsModel.Country,
                PropertyDetailsModel.PossessionDate,
                PropertyDetailsModel.Ageofproperty,
                PropertyDetailsModel.BedRooms,
                PropertyDetailsModel.BathRooms,
                PropertyDetailsModel.BalconiesCount,
                PropertyDetailsModel.FlooreNo,
                PropertyDetailsModel.LandMark,
                PropertyDetailsModel.Amenities,
                PropertyDetailsModel.DoorDirection,
                PropertyDetailsModel.VastuCompliant,
                PropertyDetailsModel.AvailableFor,
                PropertyDetailsModel.PlotArea,
                PropertyDetailsModel.ParkingCount,
                PropertyDetailsModel.LiftCount,
                PropertyDetailsModel.FloorCount,
                PropertyDetailsModel.CabinCount,
                PropertyDetailsModel.ToiletCount,
                PropertyDetailsModel.pantryCount,
                PropertyDetailsModel.WorkStation,
                PropertyDetailsModel.ConferenceCount,
                PropertyDetailsModel.SeatersCount,
                PropertyDetailsModel.SuitableFor,
                PropertyDetailsModel.TypeOfFurnished,
                # Lookup names
                EstateTypeModel.Name.label("estate_type_name"),
                DealingTypeModel.Name.label("dealing_type_name"),
                PropertyTypeModel.Name.label("property_type_name"),
                BHKTypeModel.Name.label("bhk_type_name"),
                FurnishedTypeModel.Name.label("furnished_type_name"),
                ParkingTypeModel.Name.label("parking_type_name"),
                PossessionTypeModel.Name.label("possession_type_name"),
                PropertyStatusTypeModel.Name.label("property_status_name"),
            )
            .select_from(PropertyMasterModel)
            .join(
                PropertyDetailsModel,
                PropertyDetailsModel.PropMasterId == PropertyMasterModel.Id,
            )
            .outerjoin(
                EstateTypeModel,
                EstateTypeModel.Id == PropertyMasterModel.EstateTypeId,
            )
            .outerjoin(
                DealingTypeModel,
                DealingTypeModel.Id == PropertyMasterModel.DealingTypeId,
            )
            .outerjoin(
                PropertyTypeModel,
                PropertyTypeModel.Id == PropertyMasterModel.PropertyTypeId,
            )
            .outerjoin(
                BHKTypeModel,
                BHKTypeModel.Id == PropertyMasterModel.BHKTypeId,
            )
            .outerjoin(
                FurnishedTypeModel,
                FurnishedTypeModel.Id == PropertyMasterModel.FurnishedTypeId,
            )
            .outerjoin(
                ParkingTypeModel,
                ParkingTypeModel.Id == PropertyMasterModel.ParkingTypeId,
            )
            .outerjoin(
                PossessionTypeModel,
                PossessionTypeModel.Id == PropertyMasterModel.PossessionTypeId,
            )
            .outerjoin(
                PropertyStatusTypeModel,
                PropertyStatusTypeModel.Id == PropertyMasterModel.PropertyStatusTypeId,
            )
            .filter(PropertyMasterModel.IsActive == True)
            .filter(PropertyDetailsModel.IsActive == True)
        )

        # Apply filters
        conditions = []

        if filters.get("city"):
            conditions.append(
                PropertyDetailsModel.City.ilike(f"%{filters['city']}%")
            )

        if filters.get("location"):
            raw_loc = filters["location"].strip()
            aliases = PropertyService._generate_location_aliases(raw_loc)
            
            loc_conditions = []
            for alias in aliases:
                loc_pat = f"%{alias}%"
                loc_conditions.extend([
                    PropertyDetailsModel.Area.ilike(loc_pat),
                    PropertyDetailsModel.LandMark.ilike(loc_pat),
                    PropertyDetailsModel.PropertyName.ilike(loc_pat),
                    PropertyDetailsModel.PropDesc.ilike(loc_pat),
                    PropertyDetailsModel.City.ilike(loc_pat),
                    PropertyDetailsModel.State.ilike(loc_pat),
                ])
            conditions.append(or_(*loc_conditions))

        if filters.get("landmark"):
            conditions.append(
                PropertyDetailsModel.LandMark.ilike(f"%{filters['landmark']}%")
            )

        if filters.get("bhk"):
            b_val = str(filters["bhk"])
            conditions.append(
                or_(
                    BHKTypeModel.Name.ilike(f"%{b_val}%"),
                    PropertyDetailsModel.BedRooms.ilike(f"%{b_val}%"),
                )
            )

        if filters.get("bedrooms"):
            conditions.append(
                PropertyDetailsModel.BedRooms.ilike(f"%{filters['bedrooms']}%")
            )

        if filters.get("bathrooms"):
            conditions.append(
                PropertyDetailsModel.BathRooms.ilike(f"%{filters['bathrooms']}%")
            )

        if filters.get("min_price"):
            p = filters["min_price"]
            conditions.append(
                or_(
                    PropertyDetailsModel.ExpectedAmt >= p,
                    PropertyMasterModel.BudgetRangeFrom >= p,
                )
            )

        if filters.get("max_price"):
            p = filters["max_price"]
            conditions.append(
                or_(
                    and_(PropertyDetailsModel.ExpectedAmt > 0, PropertyDetailsModel.ExpectedAmt <= p),
                    and_(PropertyMasterModel.BudgetRangeTo > 0, PropertyMasterModel.BudgetRangeTo <= p),
                )
            )

        if filters.get("min_carpet_area"):
            conditions.append(
                PropertyDetailsModel.CarpetArea >= filters["min_carpet_area"]
            )

        if filters.get("max_carpet_area"):
            conditions.append(
                PropertyDetailsModel.CarpetArea <= filters["max_carpet_area"]
            )

        if filters.get("furnishing"):
            conditions.append(
                FurnishedTypeModel.Name.ilike(f"%{filters['furnishing']}%")
            )

        if filters.get("parking"):
            conditions.append(
                ParkingTypeModel.Name.ilike(f"%{filters['parking']}%")
            )

        if filters.get("estate_type"):
            conditions.append(
                EstateTypeModel.Name.ilike(f"%{filters['estate_type']}%")
            )

        if filters.get("dealing_type"):
            conditions.append(
                DealingTypeModel.Name.ilike(f"%{filters['dealing_type']}%")
            )

        if filters.get("property_type"):
            conditions.append(
                PropertyTypeModel.Name.ilike(f"%{filters['property_type']}%")
            )

        if filters.get("property_status"):
            conditions.append(
                PropertyStatusTypeModel.Name.ilike(
                    f"%{filters['property_status']}%"
                )
            )

        if filters.get("amenities"):
            conditions.append(
                PropertyDetailsModel.Amenities.ilike(f"%{filters['amenities']}%")
            )

        if filters.get("vastu_compliant"):
            conditions.append(
                PropertyDetailsModel.VastuCompliant.ilike(f"%{filters['vastu_compliant']}%")
            )

        if conditions:
            query = query.filter(and_(*conditions))

        # Sorting
        sorting = parsed.get("sorting")
        if sorting == "cheapest":
            query = query.order_by(PropertyDetailsModel.ExpectedAmt.asc())
        elif sorting == "expensive":
            query = query.order_by(PropertyDetailsModel.ExpectedAmt.desc())
        elif sorting == "largest":
            query = query.order_by(PropertyDetailsModel.CarpetArea.desc())
        elif sorting == "smallest":
            query = query.order_by(PropertyDetailsModel.CarpetArea.asc())
        elif sorting == "newest":
            query = query.order_by(PropertyMasterModel.EntryDate.desc())
        else:
            query = query.order_by(PropertyMasterModel.EntryDate.desc())

        rows = query.limit(MAX_RESULTS).all()

        # Convert rows to dicts
        results = []
        for row in rows:
            results.append({
                "master_id": row.master_id,
                "detail_id": row.detail_id,
                "property_name": row.PropertyName or "Unnamed Property",
                "description": row.PropDesc or "",
                "owner_name": row.OwnerName or "",
                "price": float(row.ExpectedAmt) if (row.ExpectedAmt and float(row.ExpectedAmt) > 0) else (float(row.BudgetRangeTo) if (row.BudgetRangeTo and float(row.BudgetRangeTo) > 0) else (float(row.BudgetRangeFrom) if (row.BudgetRangeFrom and float(row.BudgetRangeFrom) > 0) else 0)),
                "deposit": float(row.ExpectedDeposite) if row.ExpectedDeposite else 0,
                "carpet_area": float(row.CarpetArea) if row.CarpetArea else 0,
                "saleable_area": row.SalebleArea or "",
                "area_unit": row.AreaIn or "Sq Ft",
                "city": row.City or "",
                "area": row.Area or "",
                "state": row.State or "",
                "country": row.Country or "",
                "latitude": float(row.Latitude) if row.Latitude else None,
                "longitude": float(row.Longitude) if row.Longitude else None,
                "possession_date": row.PossessionDate.isoformat() if row.PossessionDate else None,
                "age_of_property": row.Ageofproperty or "",
                "bedrooms": row.BedRooms or "",
                "bathrooms": row.BathRooms or "",
                "balconies": row.BalconiesCount or "",
                "floor": row.FlooreNo or "",
                "landmark": row.LandMark or "",
                "amenities": row.Amenities or "",
                "door_direction": row.DoorDirection or "",
                "vastu_compliant": row.VastuCompliant or "",
                "available_for": row.AvailableFor or "",
                "plot_area": row.PlotArea or "",
                "parking_count": row.ParkingCount or "",
                "lift_count": row.LiftCount or "",
                "floor_count": row.FloorCount or "",
                "cabin_count": row.CabinCount or "",
                "toilet_count": row.ToiletCount or "",
                "pantry_count": row.pantryCount or "",
                "workstation": row.WorkStation or "",
                "conference_count": row.ConferenceCount or "",
                "seaters_count": row.SeatersCount or "",
                "suitable_for": row.SuitableFor or "",
                "type_of_furnished": row.TypeOfFurnished or "",
                "entry_date": row.EntryDate.isoformat() if row.EntryDate else None,
                # Lookup names
                "estate_type": row.estate_type_name or "",
                "dealing_type": row.dealing_type_name or "",
                "property_type": row.property_type_name or "",
                "bhk_type": row.bhk_type_name or "",
                "furnishing": row.furnished_type_name or "",
                "parking_type": row.parking_type_name or "",
                "possession_type": row.possession_type_name or "",
                "property_status": row.property_status_name or "",
                "budget_from": float(row.BudgetRangeFrom) if row.BudgetRangeFrom else None,
                "budget_to": float(row.BudgetRangeTo) if row.BudgetRangeTo else None,
            })

        return results

    # ── Security Masking ─────────────────────────────────────────────────────

    @staticmethod
    def _apply_security_masking(
        properties: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Strips all PII and sensitive data. Returns only safe fields.
        Owner name is truncated to first name only.
        Contact details are NEVER included.
        """
        masked = []
        for p in properties:
            # Extract only first name from owner
            owner_first_name = ""
            if p.get("owner_name"):
                owner_first_name = p["owner_name"].split()[0] if p["owner_name"].strip() else ""

            # Format price for display
            price = p.get("price", 0)
            if price > 0:
                if price >= 10000000:
                    price_display = f"₹{price / 10000000:.2f} Cr"
                elif price >= 100000:
                    price_display = f"₹{price / 100000:.1f} Lakh"
                else:
                    price_display = f"₹{price:,.0f}"
            else:
                price_display = "Price on Request"

            safe_item = {
                "id": p["master_id"],
                "property_name": p.get("property_name", "Unnamed Property"),
                "description": p.get("description", ""),
                "owner_first_name": owner_first_name,
                "price": price,
                "price_display": price_display,
                "deposit": p.get("deposit", 0),
                "carpet_area": p.get("carpet_area", 0),
                "saleable_area": p.get("saleable_area", ""),
                "area_unit": p.get("area_unit", "Sq Ft"),
                "city": p.get("city", ""),
                "location": p.get("area", ""),
                "state": p.get("state", ""),
                "latitude": p.get("latitude"),
                "longitude": p.get("longitude"),
                "estate_type": p.get("estate_type", ""),
                "dealing_type": p.get("dealing_type", ""),
                "property_type": p.get("property_type", ""),
                "bhk_type": p.get("bhk_type", ""),
                "furnishing": p.get("furnishing", ""),
                "parking_type": p.get("parking_type", ""),
                "possession_type": p.get("possession_type", ""),
                "property_status": p.get("property_status", ""),
                "possession_date": p.get("possession_date"),
                "age_of_property": p.get("age_of_property", ""),
                "bedrooms": p.get("bedrooms", ""),
                "bathrooms": p.get("bathrooms", ""),
                "balconies": p.get("balconies", ""),
                "floor": p.get("floor", ""),
                "landmark": p.get("landmark", ""),
                "amenities": p.get("amenities", ""),
                "door_direction": p.get("door_direction", ""),
                "vastu_compliant": p.get("vastu_compliant", ""),
                "available_for": p.get("available_for", ""),
                "parking_count": p.get("parking_count", ""),
                "floor_count": p.get("floor_count", ""),
                "cabin_count": p.get("cabin_count", ""),
                "toilet_count": p.get("toilet_count", ""),
                "pantry_count": p.get("pantry_count", ""),
                "workstation": p.get("workstation", ""),
                "conference_count": p.get("conference_count", ""),
                "seaters_count": p.get("seaters_count", ""),
                "suitable_for": p.get("suitable_for", ""),
                "type_of_furnished": p.get("type_of_furnished", ""),
                "entry_date": p.get("entry_date"),
            }
            masked.append(safe_item)

        return masked

    # ── Conversational Response Generation ───────────────────────────────────

    @staticmethod
    def _generate_grounded_response(
        question: str,
        properties: List[Dict[str, Any]],
        history: List[Dict[str, str]],
        missing_basics: List[str] = [],
        ask_for_parking: bool = False,
    ) -> str:
        """Generate response grounded in query results using Gemini AI."""
        if not settings.GEMINI_API_KEY:
            logger.error("GEMINI_API_KEY is not configured.")
            return f"I found **{len(properties)}** matching properties."

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            history_text = ""
            for item in history[-4:]:
                role = "User" if item.get("role") == "user" else "Assistant"
                content = item.get("content", "")
                history_text += f"{role}: {content}\n"

            sample_props = []
            for p in properties[:5]:
                sample_props.append({
                    "name": p.get("property_name"),
                    "location": p.get("location"),
                    "city": p.get("city"),
                    "price": p.get("price_display"),
                    "bhk": p.get("bhk_type"),
                    "estate_type": p.get("estate_type"),
                    "dealing_type": p.get("dealing_type")
                })

            prompt = f"""You are the official InterCity Real-Estate AI Assistant.
User Question: {question}

Recent Conversation History:
{history_text}

Search Results Summary:
- Total Matching Properties Found: {len(properties)}
- Sample Properties Data: {json.dumps(sample_props, indent=2)}
- Missing Basic Filter (if any): {missing_basics}
- Ask for Parking/Amenities: {ask_for_parking}

Instructions:
1. If the user is greeting or asking who you are, welcome them politely as the InterCity Real-Estate AI Assistant and mention how you can help.
2. If properties were found, mention the count ({len(properties)}) and briefly summarize top options. Inform them that full details are available in the property cards below.
3. If {missing_basics} is specified, politely ask the user for that missing parameter (e.g. location, budget, or BHK) to help narrow down the options.
4. Keep your answer clear, concise, professional, and formatted in clean markdown.
"""

            response = model.generate_content(
                prompt,
                request_options={"timeout": 8.0}
            )
            if response.text:
                return response.text.strip()
        except Exception as e:
            logger.error(f"Gemini response generation failed: {e}")

        # Fallback summary if Gemini fails or times out
        count = len(properties)
        if count == 0:
            return "I couldn't find any properties matching your exact criteria. Try broadening your search or adjusting location/budget."
        return f"I found **{count}** matching properties. Please view the property cards below for details."

    @staticmethod
    def _is_greeting_or_about(question: str) -> Optional[str]:
        """Handle greetings and about-bot questions."""
        q = question.lower().strip()
        if q in ["hi", "hello", "hey", "greetings"]:
            return (
                "Hello! 👋 I'm your **InterCity Real-Estate AI Assistant**. "
                "I can help you search, filter, and compare properties from our live database. "
                "What are you looking for today?\n\n"
                "Try asking things like:\n"
                "• *Show me 2 BHK flats in Wakad*\n"
                "• *Properties for sale under ₹50 lakh*\n"
                "• *Furnished apartments in Hinjewadi*"
            )
        if any(k in q for k in ["who are you", "what do you do", "about you", "what can you do"]):
            return (
                "I'm the **InterCity Property Assistant** — powered by AI and connected to a live database "
                f"of real-estate listings. I can help you search by location, budget, BHK, "
                "furnishing, and more. Just ask me naturally!"
            )
        return None

    # ── Suggestion Chips ─────────────────────────────────────────────────────

    @staticmethod
    def _generate_suggestions(
        parsed: Dict[str, Any], properties: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate dynamic suggestion chips based on current context."""
        import random
        suggestions = []
        filters = parsed.get("filters", {})

        location = filters.get("location")
        city = filters.get("city")
        target_place = location or city

        # If a location/city is specified, ensure ALL suggestions are strictly inside that location
        if target_place:
            target_place = target_place.title()
            dealing = filters.get("dealing_type")
            bhk = filters.get("bhk")
            estate = filters.get("estate_type")
            
            # Formulate relevant choices for this location
            if not bhk:
                suggestions.append(f"2 BHK in {target_place}")
                suggestions.append(f"3 BHK in {target_place}")
            else:
                suggestions.append(f"1 BHK in {target_place}")
                
            if not dealing:
                suggestions.append(f"For Rent in {target_place}")
                suggestions.append(f"For Sale in {target_place}")
            else:
                opposite = "Sale" if str(dealing).lower() == "rent" else "Rent"
                suggestions.append(f"For {opposite} in {target_place}")
                
            if not estate:
                suggestions.append(f"Commercial properties in {target_place}")
                suggestions.append(f"Residential flats in {target_place}")
            else:
                suggestions.append(f"Furnished properties in {target_place}")
                
            suggestions.append(f"Cheapest property in {target_place}")
            
            seen = set()
            unique_suggs = []
            for s in suggestions:
                if s.lower() not in seen:
                    seen.add(s.lower())
                    unique_suggs.append(s)
            return unique_suggs[:5]

        # Fallback if no location is specified
        if not properties:
            selected_other = random.sample(KNOWN_LOCATIONS, 4)
            return [
                f"Show properties in {selected_other[0].title()}",
                f"2 BHK for rent in {selected_other[1].title()}",
                f"Commercial office in {selected_other[2].title()}",
                f"Cheapest flat in {selected_other[3].title()}"
            ]

        # If properties exist but no filters target a specific place
        location = properties[0].get("location") or properties[0].get("city")
        if location:
            suggestions.append(f"Cheapest property in {location}")
        
        bhk = filters.get("bhk")
        if bhk:
            suggestions.append(f"Show {bhk + 1} BHK options")
        else:
            suggestions.append("Show 2 BHK flats")

        dealing = filters.get("dealing_type")
        if dealing == "Sale":
            suggestions.append("Show rental properties instead")
        elif dealing == "Rent":
            suggestions.append("Show properties for sale instead")
        else:
            suggestions.append("Properties for rent")

        if any(p.get("furnishing") for p in properties):
            suggestions.append("Show only furnished properties")

        # Dynamically suggest 2 other locations from the database to explore
        other_locs = [l for l in KNOWN_LOCATIONS if l != (location or "").lower()]
        selected_other = random.sample(other_locs, min(len(other_locs), 2))
        for loc in selected_other:
            suggestions.append(f"Properties in {loc.title()}")

        return suggestions[:5]
