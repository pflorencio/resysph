from fastapi import APIRouter, HTTPException
from prisma_client.models import Table as TableModel
from db import prisma

router = APIRouter(prefix="/tables", tags=["tables"])

@router.get("", response_model=list[TableModel])
async def list_tables():
    return await prisma.table.find_many()

@router.get("/{id}", response_model=TableModel)
async def get_table(id: int):
    table = await prisma.table.find_unique(where={"id": id})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table
