# backend/routes/routes.py
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
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


# -----------------------------
# Members
# -----------------------------

@router.get("/members", response_model=List[MemberModel], tags=["members"])
async def list_members(
    q: Optional[str] = Query(None, description="Search by email, name, or phone"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    List members with simple search & pagination.
    NOTE: Avoids `mode: 'insensitive'` (not supported reliably in Prisma Python/SQLite).
    """
    if q:
        try:
            return await prisma.member.find_many(
                where={
                    "OR": [
                        {"email": {"contains": q}},
                        {"name": {"contains": q}},
                        {"phone": {"contains": q}},
                    ]
                },
                take=limit,
                skip=offset,
            )
        except Exception as e:
            # Surface a readable client error instead of 500
            raise HTTPException(status_code=400, detail=f"Invalid search: {e}")
    return await prisma.member.find_many(take=limit, skip=offset)


@router.post("/members", response_model=MemberModel, status_code=201, tags=["members"])
async def create_member(payload: MemberCreate):
    """
    Create a member. Returns 409 if the email already exists.
    (DB has a UNIQUE index on Member.email.)
    """
    # Fast path: if email exists, return 409 without hitting the constraint
    existing = await prisma.member.find_unique(where={"email": payload.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists.")

    try:
        return await prisma.member.create(
            data={
                "name": payload.name,     # normalized by schema
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
