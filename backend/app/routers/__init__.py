"""
AI Data Analyst - Routers Package
====================================
Exports all router modules for clean imports in main.py
"""

from app.routers import (
    health,
    auth,
    admin,
    chatbot,
)

__all__ = [
    "health",
    "auth",
    "admin",
    "chatbot",
]
