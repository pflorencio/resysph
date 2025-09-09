from fastapi import APIRouter, HTTPException
from prisma_client.models import Reservation as ReservationModel
from db import prisma
from schemas import ReservationCreate
from typing import Literal

router = APIRouter(prefix="/reservations", tags=["reservations"])

@router.get("", response_model=list[ReservationModel])
async def list_reservations(
    limit: int = 50, offset: int = 0, sort: Literal["date", "-date"] = "date"
):
    order = {"date": "asc" if sort == "date" else "desc"}
    return await prisma.reservation.find_many(skip=offset, take=limit, order=order)

@router.post("", response_model=ReservationModel, status_code=201)
async def create_reservation(payload: ReservationCreate):
    # 1) Validate table exists
    try:
        table = await prisma.table.find_unique(where={"id": payload.table_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"step": "find_table", "error": repr(e)})
    if not table:
        raise HTTPException(status_code=400, detail="table_id does not exist")

    # 2) Resolve member_id: use provided, or reuse/create by email
    try:
        member_id = payload.member_id
        if member_id is None:
            # find by email (exact match)
            existing = await prisma.member.find_first(where={"email": payload.email})
            if existing:
                member_id = existing.id
            else:
                created = await prisma.member.create(
                    data={
                        # Your Member model uses a single `name` column (confirmed earlier)
                        "name": (payload.name or "").strip(),
                        "email": payload.email,
                        "phone": payload.phone,
                    }
                )
                member_id = created.id
    except Exception as e:
        raise HTTPException(status_code=500, detail={"step": "resolve_member", "error": repr(e)})

    # 3) Create reservation (match your Prisma model exactly)
    try:
        created = await prisma.reservation.create(
            data={
                "date": payload.reservation_time,  # Prisma field is `date`
                "tableId": payload.table_id,       # Prisma field is `tableId`
                "memberId": member_id,             # Prisma field is `memberId`
            }
        )
        return created
    except Exception as e:
        raise HTTPException(status_code=500, detail={"step": "create_reservation", "error": repr(e)})
