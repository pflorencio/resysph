from fastapi import APIRouter
from prisma_client import Prisma

router = APIRouter()
prisma = Prisma()

@router.get("/reservations")
async def get_reservations():
    await prisma.connect()
    data = await prisma.reservation.find_many(
        include={
            "table": True,
            "member": True
        }
    )
    await prisma.disconnect()
    return data
