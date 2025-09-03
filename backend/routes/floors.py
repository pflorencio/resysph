from fastapi import APIRouter
from prisma_client import Prisma

router = APIRouter()
prisma = Prisma()

@router.get("/floors")
async def get_floors():
    await prisma.connect()
    data = await prisma.floor.find_many()
    await prisma.disconnect()
    return data
