from fastapi import APIRouter, HTTPException
from prisma_client.models import Restaurant as RestaurantModel
from db import prisma

router = APIRouter(prefix="/restaurants", tags=["restaurants"])

@router.get("", response_model=list[RestaurantModel])
async def list_restaurants():
    return await prisma.restaurant.find_many()

@router.get("/{id}", response_model=RestaurantModel)
async def get_restaurant_layout(id: int):
    restaurant = await prisma.restaurant.find_unique(
        where={"id": id},
        include={"floors": {"include": {"tables": True}}},
    )
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant
