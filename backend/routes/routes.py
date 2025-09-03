from fastapi import APIRouter
from db import prisma
from schemas import MemberCreate
from prisma_client.models import Member as MemberModel

from .restaurants import router as restaurants_router
from .reservations import router as reservations_router

router = APIRouter()

# Mount sub-routers
router.include_router(restaurants_router)
router.include_router(reservations_router)

# Members (single `name` column in DB)
@router.post("/members", response_model=MemberModel, tags=["members"])
async def create_member(payload: MemberCreate):
    return await prisma.member.create(
        data={
            "name": payload.name,    # normalized by schema (from name OR first/last)
            "email": payload.email,
            "phone": payload.phone,
        }
    )
