from fastapi import APIRouter, HTTPException
from prisma_client.models import Reservation as ReservationModel
from db import prisma
from schemas import ReservationCreate

router = APIRouter(prefix="/reservations", tags=["reservations"])

@router.get("", response_model=list[ReservationModel])
async def list_reservations():
    return await prisma.reservation.find_many(include={"member": True, "table": True})

@router.post("", response_model=ReservationModel)
async def create_reservation(payload: ReservationCreate):
    if payload.member_id:
        member = await prisma.member.find_unique(where={"id": payload.member_id})
        if not member:
            raise HTTPException(status_code=400, detail="member_id does not exist")
    if payload.table_id:
        table = await prisma.table.find_unique(where={"id": payload.table_id})
        if not table:
            raise HTTPException(status_code=400, detail="table_id does not exist")

    return await prisma.reservation.create(
        data={
            "restaurant_id": payload.restaurant_id,
            "floor_id": payload.floor_id,
            "table_id": payload.table_id,
            "member_id": payload.member_id,
            "name": payload.name,
            "email": payload.email,
            "phone": payload.phone,
            "party_size": payload.party_size,
            "reservation_time": payload.reservation_time,
            "notes": payload.notes,
        }
    )
