from fastapi import APIRouter
from prisma_client import Prisma

router = APIRouter()
prisma = Prisma()

@router.get("/restaurants")
async def get_restaurants():
    await prisma.connect()
    data = await prisma.restaurant.find_many()
    await prisma.disconnect()
    return data
