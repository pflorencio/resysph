from fastapi import APIRouter, HTTPException
from typing import List
from prisma.models import Restaurant, Floor, Table, Reservation, Member
from prisma import Prisma
from schemas import MemberCreate, ReservationCreate

router = APIRouter()
db = Prisma()

# -------------------------
# Restaurant Routes
# -------------------------

@router.get("/restaurants", response_model=List[Restaurant])
async def get_restaurants():
    await db.connect()
    restaurants = await db.restaurant.find_many()
    await db.disconnect()
    return restaurants

@router.get("/restaurants/{id}")
async def get_restaurant_layout(id: str):
    await db.connect()
    restaurant = await db.restaurant.find_unique(
        where={"id": id},
        include={
            "floors": {
                "include": {
                    "tables": True
                }
            }
        }
    )
    await db.disconnect()

    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    return restaurant

# -------------------------
# Member Routes
# -------------------------

@router.post("/members", response_model=Member)
async def create_member(member: MemberCreate):
    await db.connect()
    created = await db.member.create(
        data={
            "first_name": member.first_name,
            "last_name": member.last_name,
            "email": member.email,
        }
    )
    await db.disconnect()
    return created

# -------------------------
# Reservation Routes
# -------------------------

@router.get("/reservations", response_model=List[Reservation])
async def list_reservations():
    await db.connect()
    reservations = await db.reservation.find_many(
        include={"member": True, "table": True}
    )
    await db.disconnect()
    return reservations

@router.post("/reservations", response_model=Reservation)
async def create_reservation(res: ReservationCreate):
    await db.connect()

    # Check if table exists
    table = await db.table.find_unique(where={"id": res.table_id})
    if not table:
        await db.disconnect()
        raise HTTPException(status_code=404, detail="Table not found")

    # Check for time conflict (simplified)
    existing = await db.reservation.find_first(
        where={
            "table_id": res.table_id,
            "datetime": res.datetime
        }
    )
    if existing:
        await db.disconnect()
        raise HTTPException(status_code=400, detail="Table already booked for that time")

    # Create reservation
    created = await db.reservation.create(
        data={
            "member_id": res.member_id,
            "table_id": res.table_id,
            "datetime": res.datetime,
            "party_size": res.party_size,
            "notes": res.notes,
        }
    )

    await db.disconnect()
    return created
