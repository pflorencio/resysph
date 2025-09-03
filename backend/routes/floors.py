from fastapi import APIRouter, HTTPException
from prisma_client.models import Floor as FloorModel
from db import prisma

router = APIRouter(prefix="/floors", tags=["floors"])

@router.get("/{id}", response_model=FloorModel)
async def get_floor(id: int):
    floor = await prisma.floor.find_unique(
        where={"id": id},
        include={"tables": True},
    )
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    return floor
