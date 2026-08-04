"""
Rate Limiting Middleware & Utilities
===================================
Configures SlowAPI rate limiting for authentication endpoints and general API protection.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request

from app.utils.device_parser import get_client_ip

def rate_limit_key_func(request: Request) -> str:
    """Extract real client IP considering proxies and headers."""
    return get_client_ip(request) or "127.0.0.1"

# Global Limiter instance
limiter = Limiter(
    key_func=rate_limit_key_func,
    default_limits=["120/minute"],
    headers_enabled=True,
)
