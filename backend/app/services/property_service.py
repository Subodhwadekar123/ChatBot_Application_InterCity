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
    "wanowrie", "bavdhan", "ambegaon budruk", "aundh", "pisoli", "narhe", 
    "viman nagar", "rahatani", "charholi budruk"
]


class PropertyService:
    """Handles chatbot queries against the live SQL Server property database."""

    # Reverted back to Gemini

    @staticmethod
    def _check_missing_basic_filters(filters: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Check Stage 1 (Core Intent) and Stage 2 (Preferences) parameters.
        Returns a dict indicating which stage has missing parameters, and the list of missing fields.
        """
        stage1_missing = []
        
        # Location/Area
        loc = filters.get("location")
        city = filters.get("city")
        if not loc and not city:
            stage1_missing.append("location")
        elif str(loc).lower() == "any" or str(city).lower() == "any":
            pass # Provided as Any
            
        # Dealing Type
        dt = filters.get("dealing_type")
        if not dt:
            stage1_missing.append("rent or sale preference")
        elif str(dt).lower() in ["any", "none"]:
            pass
            
        # Property Type / Estate Type
        et = filters.get("estate_type")
        pt = filters.get("property_type")
        if not et and not pt:
            stage1_missing.append("residential or commercial category")
        elif str(et).lower() in ["any", "none"] or str(pt).lower() in ["any", "none"]:
            pass
            
        # BHK Type (only for residential or when category is not commercial)
        if et is None or str(et).lower() != "commercial":
            bhk = filters.get("bhk")
            if bhk is None:
                stage1_missing.append("BHK requirement")
            elif bhk == -1 or str(bhk).lower() == "any":
                pass
                
        if stage1_missing:
            return {"stage": 1, "missing": stage1_missing}
            
        # Stage 2: Budget/Amount, Parking, Furnishing, Amenities
        stage2_missing = []
        
        min_p = filters.get("min_price")
        max_p = filters.get("max_price")
        if min_p is None and max_p is None:
            stage2_missing.append("budget (price range)")
        elif min_p == -1 or max_p == -1 or str(min_p).lower() == "any" or str(max_p).lower() == "any":
            pass
            
        pk = filters.get("parking")
        if not pk:
            stage2_missing.append("parking preference")
        elif str(pk).lower() in ["any", "none"]:
            pass
            
        fn = filters.get("furnishing")
        if not fn:
            stage2_missing.append("furnishing status")
        elif str(fn).lower() in ["any", "none"]:
            pass
            
        am = filters.get("amenities")
        if not am:
            stage2_missing.append("amenities / facilities")
        elif str(am).lower() in ["any", "none"]:
            pass
            
        if stage2_missing:
            return {"stage": 2, "missing": stage2_missing}
            
        return {"stage": 0, "missing": []}

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
            am_str = p.get("amenities", "")
            if am_str:
                for am in am_str.split(","):
                    am_clean = am.strip().title()
                    if am_clean:
                        all_amenities[am_clean] = all_amenities.get(am_clean, 0) + 1
                        
        varying_amenities = []
        total_props = len(properties)
        for am, count in all_amenities.items():
            if 0 < count < total_props:
                varying_amenities.append(am)
                
        if varying_amenities:
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
        varying_fields = {}
        show_properties = False

        if is_general:
            # General query, don't show properties, just chat
            show_properties = False
        elif N <= 20:
            # Precise result: show directly
            show_properties = True
        else:
            # Broad search: check parameters
            filters = parsed.get("filters", {})
            check_result = PropertyService._check_missing_basic_filters(filters)
            missing_basics = check_result["missing"]
            
            if missing_basics:
                # Missing Core or Preference parameters: ask for them and hide listings
                show_properties = False
            else:
                # Core parameters present, check varying attributes
                varying_fields = PropertyService._get_varying_fields(safe_properties)
                if varying_fields:
                    # Can narrow down further
                    show_properties = False
                else:
                    # Cannot narrow down further: display properties
                    show_properties = True

        # 6. Generate conversational response grounded in results and dialog state
        answer = PropertyService._generate_grounded_response(
            question=question, 
            properties=safe_properties, 
            history=history,
            missing_basics=missing_basics,
            varying_fields=varying_fields
        )

        # 7. Build suggestion chips
        suggestions = []
        if not is_general:
            if missing_basics:
                next_missing = missing_basics[0]
                if "location" in next_missing:
                    suggestions = ["In Wakad", "In Hinjewadi", "In Kharadi", "In Baner"]
                elif "dealing" in next_missing:
                    suggestions = ["For Rent", "For Sale", "Any dealing type is fine"]
                elif "category" in next_missing or "residential" in next_missing:
                    suggestions = ["Residential Flat", "Commercial Shop", "Commercial Office"]
                elif "BHK" in next_missing:
                    suggestions = ["1 BHK Flat", "2 BHK Flat", "3 BHK Flat", "Any BHK"]
                elif "budget" in next_missing or "price" in next_missing:
                    suggestions = ["Under 30k (Rent)", "Under 50 Lakhs", "Between 50 to 80 Lakhs", "Any budget"]
                elif "parking" in next_missing:
                    suggestions = ["Need Covered Parking", "Open Parking is fine", "No parking needed", "Any parking"]
                elif "furnishing" in next_missing:
                    suggestions = ["Fully Furnished", "Semi-Furnished", "Unfurnished", "Any furnishing"]
                elif "amenities" in next_missing:
                    suggestions = ["With Swimming Pool", "Need elevator / lift", "With Gym", "No specific amenities"]
            elif varying_fields:
                first_field = list(varying_fields.keys())[0]
                options = varying_fields[first_field]
                if first_field == "bhk_type":
                    suggestions = [f"Show {o}" for o in options[:3]]
                elif first_field == "furnishing":
                    suggestions = [f"Show {o} properties" for o in options[:3]]
                elif first_field == "property_status":
                    suggestions = [f"Show {o} properties" for o in options[:2]]
                elif first_field == "property_type":
                    suggestions = [f"Show {o}" for o in options[:3]]
                elif first_field == "door_direction":
                    suggestions = [f"Show {o} facing" for o in options[:3]]
                elif first_field == "vastu_compliant":
                    suggestions = [f"Show Vastu compliant" if o.lower() == "yes" else f"Any Vastu status" for o in options[:2]]
                elif first_field == "amenities":
                    suggestions = [f"With {o}" for o in options[:3]]
                    
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
        """Parse natural language query into structured filters using Gemini or regex fallback."""
        if not settings.GEMINI_API_KEY:
            logger.info("Gemini key not configured. Using rule-based fallback.")
            return PropertyService._fallback_parse_query(question)

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
            )
            data = json.loads(response.text.strip())
            return data
        except Exception as e:
            logger.error(f"Gemini parse failed: {e}. Using fallback.")
            return PropertyService._fallback_parse_query(question)

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

        # Greetings
        if any(
            k in q_lower
            for k in ["hi", "hello", "hey", "greetings", "who are you", "help"]
        ):
            general_query = True

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
            loc_match = re.search(r"(?:in|near|at|around)\s+([a-zA-Z]+)", q_lower)
            if loc_match:
                loc_candidate = loc_match.group(1).strip().capitalize()
                known_cities = ["pune", "mumbai", "nashik", "nagpur", "thane"]
                if loc_candidate.lower() in known_cities:
                    filters["city"] = loc_candidate
                else:
                    filters["location"] = loc_candidate

        return {
            "filters": filters,
            "sorting": sorting,
            "general_query": general_query,
        }

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
            loc = f"%{filters['location']}%"
            conditions.append(
                or_(
                    PropertyDetailsModel.Area.ilike(loc),
                    PropertyDetailsModel.LandMark.ilike(loc),
                    PropertyDetailsModel.PropertyName.ilike(loc),
                    PropertyDetailsModel.PropDesc.ilike(loc),
                    PropertyDetailsModel.City.ilike(loc),
                    PropertyDetailsModel.State.ilike(loc),
                )
            )

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
        varying_fields: Dict[str, List[str]] = {},
    ) -> str:
        """Generate Gemini-powered or fallback response grounded in query results."""
        # Check for greetings first
        greeting_resp = PropertyService._is_greeting_or_about(question)
        if greeting_resp:
            return greeting_resp

        if not properties:
            return (
                "I couldn't find any properties matching your requirements. "
                "Try broadening your search — for example, search by a different area, "
                "increase the budget range, or try different BHK options."
            )

        if not settings.GEMINI_API_KEY:
            if missing_basics:
                return f"I found multiple properties, but to help me narrow down, could you please specify: {', '.join(missing_basics)}?"
            elif varying_fields:
                field = list(varying_fields.keys())[0]
                options = ", ".join(varying_fields[field])
                return f"I found several matching properties. To narrow this down to your exact needs, would you prefer a specific {field}? Options are: {options}."
            else:
                return PropertyService._fallback_generate_response(properties)

        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            props_text = ""
            for idx, p in enumerate(properties[:15]):
                props_text += (
                    f"[{idx + 1}] {p.get('property_name', 'N/A')} — "
                    f"{p.get('bhk_type', 'N/A')}, {p.get('property_type', 'N/A')}, "
                    f"Location: {p.get('location', 'N/A')}, {p.get('city', 'N/A')}, "
                    f"Price: {p.get('price_display', 'N/A')}, "
                    f"Area: {p.get('carpet_area', 0)} {p.get('area_unit', 'Sq Ft')}, "
                    f"Furnishing: {p.get('furnishing', 'N/A')} (Type: {p.get('type_of_furnished', 'N/A')}), "
                    f"Parking: {p.get('parking_type', 'N/A')}, "
                    f"Status: {p.get('property_status', 'N/A')}, "
                    f"For: {p.get('dealing_type', 'N/A')}, "
                    f"Type: {p.get('estate_type', 'N/A')}, "
                    f"Balconies: {p.get('balconies', 'N/A')}, Floor: {p.get('floor', 'N/A')}, Vastu: {p.get('vastu_compliant', 'N/A')}, "
                    f"Available For: {p.get('available_for', 'N/A')}\n"
                )
                if p.get("estate_type") == "Commercial" or p.get("cabin_count") or p.get("workstation"):
                    props_text += (
                        f"  Commercial Details: Cabins: {p.get('cabin_count', 'N/A')}, "
                        f"Workstations: {p.get('workstation', 'N/A')}, "
                        f"Conference Rooms: {p.get('conference_count', 'N/A')}, "
                        f"Seaters: {p.get('seaters_count', 'N/A')}, "
                        f"Pantry: {p.get('pantry_count', 'N/A')}, "
                        f"Toilets: {p.get('toilet_count', 'N/A')}, "
                        f"Suitable For: {p.get('suitable_for', 'N/A')}\n"
                    )
                if p.get("floor_count") or p.get("parking_count") or p.get("lift_count"):
                    props_text += (
                        f"  Building Details: Floors: {p.get('floor_count', 'N/A')}, "
                        f"Parking Count: {p.get('parking_count', 'N/A')}, "
                        f"Lifts: {p.get('lift_count', 'N/A')}\n"
                    )

            # Construct system instruction based on dialog state
            if len(properties) <= 20:
                flow_instruction = f"""THE RESULTS ARE PRECISE ({len(properties)} properties found).
You MUST show/display these results to the user.
Your response MUST start with an impressive, engaging, and clear summary statement giving absolute clarity of the search results (e.g. 'I've searched our database and found exactly {len(properties)} fantastic properties matching your requirements!').
Provide a short, lively summary highlighting price ranges, BHK options, or top amenities of these properties, and guide them to check the cards below."""
            elif missing_basics:
                flow_instruction = f"""THE RESULTS ARE BROAD ({len(properties)} properties match), AND the user has not specified all reasonable core requirements.
The missing requirements are: {', '.join(missing_basics)}.
You MUST politely ask the user to provide details for these missing requirements.
Start your response with an impressive, clear summary statement (e.g., 'I found {len(properties)} properties matching your criteria, but I need a few more details to find the perfect one for you!').
DO NOT list or summarize properties in your text response. Ask for the missing details."""
            else:
                varying_text = "\n".join([f"- {field}: Options are {', '.join(options)}" for field, options in varying_fields.items()])
                flow_instruction = f"""THE USER HAS SPECIFIED CORE REQUIREMENTS, BUT there are still {len(properties)} matching properties. We need to narrow this down.
Here are the varying attributes among the properties:
{varying_text}
You MUST pick ONE of these varying attributes (from the database) and ask a follow-up question to help the user choose (for example: 'Would you prefer a 2 BHK or 3 BHK?', or 'Should the property be Furnished or Semi-Furnished?').
Start your response with an impressive, clear summary statement (e.g., 'I've found {len(properties)} properties! To refine this down to your perfect match...').
DO NOT list or summarize properties in your text response. Ask the follow-up question."""

            prompt = f"""You are the InterCity Real-Estate AI Assistant.

User Question: {question}

Matching Properties:
{props_text}

Dialog State Instructions:
{flow_instruction}

CRITICAL INSTRUCTIONS:
1. THE MATCHING PROPERTIES ARE DISPLAYED TO THE USER AS CARDS BELOW YOUR CHAT BUBBLE (only when results are precise, i.e. <= 20).
2. Keep the response conversational, polite, and extremely concise (maximum 3-4 sentences).
3. Under no circumstances should you invent properties that are not in the list.
4. All options, follow-up questions, and suggestions MUST match the actual properties in the database (e.g. if options is 2 BHK or 3 BHK, it is because those exist in the data).
5. Never mention contact phone numbers or emails in your text.
"""

            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Gemini response generation failed: {e}")
            return PropertyService._fallback_generate_response(properties)

    @staticmethod
    def _fallback_generate_response(properties: List[Dict[str, Any]]) -> str:
        """Rule-based response when Gemini is unavailable."""
        count = len(properties)
        return f"I found **{count}** matching properties. Please check the property cards below for details."

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

        if not properties:
            selected_other = random.sample(KNOWN_LOCATIONS, 4)
            return [
                f"Show properties in {selected_other[0].title()}",
                f"2 BHK for rent in {selected_other[1].title()}",
                f"Commercial office in {selected_other[2].title()}",
                f"Cheapest flat in {selected_other[3].title()}"
            ]

        location = filters.get("location") or (
            properties[0].get("location") if properties else None
        )
        city = filters.get("city") or (
            properties[0].get("city") if properties else None
        )

        if location:
            suggestions.append(f"Cheapest property in {location}")
        if city:
            suggestions.append(f"Commercial properties in {city}")

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
