from fastapi import APIRouter
from prisma_client import Prisma

router = APIRouter()
prisma = Prisma()

@router.get("/tables")
async def get_tables():
    await prisma.connect()
    data = await prisma.table.find_many()
    await prisma.disconnect()
    return data
