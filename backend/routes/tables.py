# backend/routes/tables.py
from __future__ import annotations

from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db import prisma
from prisma_client.models import Table as TableModel

router = APIRouter(prefix="/tables", tags=["tables"])


# ---- Schemas for layout updates ----
class TableLayoutUpdate(BaseModel):
    posX: Optional[int] = None
    posY: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    rotation: Optional[int] = None
    label: Optional[str] = None
    area: Optional[str] = None


class TableLayoutPatch(BaseModel):
    id: int
    posX: Optional[int] = None
    posY: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    rotation: Optional[int] = None
    label: Optional[str] = None
    area: Optional[str] = None


@router.get("", response_model=list[TableModel])
async def list_tables():
    return await prisma.table.find_many()


@router.get("/layout", response_model=list[TableModel])
async def get_layout():
    # same as list, just explicit route for layout tools
    return await prisma.table.find_many()


@router.patch("/{id}/layout", response_model=TableModel)
async def update_layout(id: int, body: TableLayoutUpdate):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No layout fields supplied.")
    exists = await prisma.table.find_unique(where={"id": id})
    if not exists:
        raise HTTPException(status_code=404, detail="Table not found.")
    return await prisma.table.update(where={"id": id}, data=data)


@router.patch("/layout/bulk", response_model=list[TableModel])
async def update_layout_bulk(body: List[TableLayoutPatch]):
    updated: list[TableModel] = []
    for item in body:
        data = {k: v for k, v in item.model_dump().items() if k != "id" and v is not None}
        if not data:
            # skip empty entries
            continue
        exists = await prisma.table.find_unique(where={"id": item.id})
        if not exists:
            continue
        upd = await prisma.table.update(where={"id": item.id}, data=data)
        updated.append(upd)
    return updated
