# backend/db.py
from prisma_client import Prisma

# Shared Prisma instance
prisma = Prisma()

async def connect() -> None:
    """Connect to the database if not already connected."""
    if not prisma.is_connected():
        await prisma.connect()

async def disconnect() -> None:
    """Disconnect from the database if connected."""
    if prisma.is_connected():
        await prisma.disconnect()
