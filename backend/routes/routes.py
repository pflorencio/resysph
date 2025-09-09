# backend/routes/routes.py
from fastapi import APIRouter, HTTPException
from db import prisma
from schemas import MemberCreate
from prisma_client.models import Member as MemberModel

from .restaurants import router as restaurants_router
from .reservations import router as reservations_router
from .tables import router as tables_router

router = APIRouter()

# Mount sub-routers
router.include_router(restaurants_router)
router.include_router(reservations_router)
router.include_router(tables_router)


# Members (DB uses a single `name` column)
@router.post("/members", response_model=MemberModel, status_code=201, tags=["members"])
async def create_member(payload: MemberCreate):
    # Fast path: if email exists, return 409 without hitting the constraint
    existing = await prisma.member.find_unique(where={"email": payload.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists.")

    try:
        return await prisma.member.create(
            data={
                "name": payload.name,     # already normalized by schema
                "email": payload.email,
                "phone": payload.phone,
            }
        )
    except Exception as e:
        # Safety net: map unique-constraint errors to 409 (covers various drivers/msgs)
        msg = str(e)
        if (
            "UNIQUE constraint failed" in msg
            or "Unique constraint failed" in msg
            or "P2002" in msg  # Prisma unique violation code in some contexts
        ):
            raise HTTPException(status_code=409, detail="Email already exists.")
        # Otherwise bubble up a useful 500
        raise HTTPException(status_code=500, detail=f"Create member failed: {msg}")
