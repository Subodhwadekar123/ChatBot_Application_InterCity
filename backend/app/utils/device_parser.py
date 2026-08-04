"""
Device Parser Utility
======================
Parses HTTP User-Agent strings to extract browser, OS, and device type.
Uses the `user-agents` library for reliable parsing.
"""

from typing import Optional
import re


def parse_user_agent(user_agent_string: Optional[str]) -> dict:
    """
    Parse a User-Agent string into structured device information.
    
    Returns a dict with:
      - browser:         Browser name (Chrome, Firefox, Safari, etc.)
      - browser_version: Browser version string
      - os:              Operating system name
      - os_version:      OS version string
      - device_type:     desktop | mobile | tablet | bot | unknown
      - device_name:     Device brand + model (if mobile)
    """
    if not user_agent_string:
        return _unknown_device()

    try:
        import user_agents
        ua = user_agents.parse(user_agent_string)

        # Determine device type
        if ua.is_bot:
            device_type = "bot"
        elif ua.is_mobile:
            device_type = "mobile"
        elif ua.is_tablet:
            device_type = "tablet"
        else:
            device_type = "desktop"

        # Device name (brand + model)
        device_parts = []
        if ua.device.brand:
            device_parts.append(ua.device.brand)
        if ua.device.model and ua.device.model != ua.device.brand:
            device_parts.append(ua.device.model)
        device_name = " ".join(device_parts) if device_parts else device_type.capitalize()

        # OS version cleanup
        os_version = ".".join(str(v) for v in ua.os.version if v) if ua.os.version else ""

        # Browser version cleanup
        browser_version = ".".join(str(v) for v in ua.browser.version[:2] if v) if ua.browser.version else ""

        return {
            "browser": ua.browser.family or "Unknown",
            "browser_version": browser_version,
            "os": ua.os.family or "Unknown",
            "os_version": os_version,
            "device_type": device_type,
            "device_name": device_name,
        }

    except ImportError:
        # Fallback: basic regex parsing if user-agents not available
        return _parse_basic(user_agent_string)
    except Exception:
        return _unknown_device()


def _unknown_device() -> dict:
    return {
        "browser": "Unknown",
        "browser_version": "",
        "os": "Unknown",
        "os_version": "",
        "device_type": "unknown",
        "device_name": "Unknown",
    }


def _parse_basic(ua_string: str) -> dict:
    """Basic regex fallback for UA parsing without the library."""
    result = _unknown_device()

    # Browser detection
    if "Chrome" in ua_string and "Edg" not in ua_string and "OPR" not in ua_string:
        result["browser"] = "Chrome"
        m = re.search(r"Chrome/(\d+\.\d+)", ua_string)
        if m:
            result["browser_version"] = m.group(1)
    elif "Firefox" in ua_string:
        result["browser"] = "Firefox"
        m = re.search(r"Firefox/(\d+\.\d+)", ua_string)
        if m:
            result["browser_version"] = m.group(1)
    elif "Safari" in ua_string and "Chrome" not in ua_string:
        result["browser"] = "Safari"
    elif "Edg" in ua_string:
        result["browser"] = "Edge"
    elif "OPR" in ua_string or "Opera" in ua_string:
        result["browser"] = "Opera"

    # OS detection
    if "Windows NT" in ua_string:
        result["os"] = "Windows"
        m = re.search(r"Windows NT (\d+\.\d+)", ua_string)
        if m:
            nt_map = {"10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7"}
            result["os_version"] = nt_map.get(m.group(1), m.group(1))
    elif "Mac OS X" in ua_string:
        result["os"] = "macOS"
        m = re.search(r"Mac OS X (\d+[._]\d+)", ua_string)
        if m:
            result["os_version"] = m.group(1).replace("_", ".")
    elif "Android" in ua_string:
        result["os"] = "Android"
        m = re.search(r"Android (\d+\.\d+)", ua_string)
        if m:
            result["os_version"] = m.group(1)
        result["device_type"] = "mobile"
    elif "iPhone" in ua_string or "iPad" in ua_string:
        result["os"] = "iOS"
        result["device_type"] = "mobile" if "iPhone" in ua_string else "tablet"
    elif "Linux" in ua_string:
        result["os"] = "Linux"

    return result


def get_client_ip(request) -> Optional[str]:
    """
    Extract the real client IP from a FastAPI Request.
    Handles proxy headers (X-Forwarded-For, X-Real-IP).
    """
    # Check for proxy headers first
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP (client's original IP)
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fallback to direct connection
    if request.client:
        return request.client.host

    return None
