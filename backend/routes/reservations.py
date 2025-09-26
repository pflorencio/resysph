# backend/routes/reservations.py
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal, Optional, Dict

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from fastapi.responses import StreamingResponse

import csv
import io

from prisma_client.models import Reservation as ReservationModel
from db import prisma
from schemas import ReservationCreate, ReservationStatus

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.get("", response_model=list[ReservationModel])
async def list_reservations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort: Literal["date", "-date"] = "date",
):
    order = {"date": "asc" if sort == "date" else "desc"}
    return await prisma.reservation.find_many(skip=offset, take=limit, order=order)


@router.post("", response_model=ReservationModel, status_code=201)
async def create_reservation(payload: ReservationCreate):
    # 1) Validate table
    try:
        table = await prisma.table.find_unique(where={"id": payload.table_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail={"step": "find_table", "error": repr(e)})
    if not table:
        raise HTTPException(status_code=400, detail="table_id does not exist")

    # 2) Resolve member
    try:
        member_id = payload.member_id
        if member_id is None:
            existing = await prisma.member.find_first(where={"email": payload.email})
            if existing:
                member_id = existing.id
            else:
                created = await prisma.member.create(
                    data={
                        "name": (payload.name or "").strip(),
                        "email": payload.email,
                        "phone": payload.phone,
                    }
                )
                member_id = created.id
    except Exception as e:
        raise HTTPException(status_code=500, detail={"step": "resolve_member", "error": repr(e)})

    # 3) Double-booking guard
    try:
        conflict = await prisma.reservation.find_first(
            where={"tableId": payload.table_id, "date": payload.reservation_time}
        )
        if conflict:
            raise HTTPException(status_code=409, detail="That table is already booked at that time.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"step": "conflict_check", "error": repr(e)})

    # 4) Create
    try:
        data: dict = {
            "date": payload.reservation_time,
            "tableId": payload.table_id,
            "memberId": member_id,
        }
        if payload.status:
            data["status"] = payload.status
        if payload.party_size is not None:
            data["partySize"] = payload.party_size
        if payload.notes:
            data["notes"] = payload.notes

        created = await prisma.reservation.create(data=data)
        return created
    except Exception as e:
        raise HTTPException(status_code=500, detail={"step": "create_reservation", "error": repr(e)})


class ReservationUpdate(BaseModel):
    table_id: Optional[int] = None
    reservation_time: Optional[datetime] = None
    status: Optional[ReservationStatus] = None
    party_size: Optional[int] = None
    notes: Optional[str] = None


@router.patch("/{id}", response_model=ReservationModel)
async def update_reservation(id: int, body: ReservationUpdate):
    current = await prisma.reservation.find_unique(where={"id": id})
    if not current:
        raise HTTPException(status_code=404, detail="Reservation not found")

    data: dict = {}
    new_table_id = current.tableId
    new_date = current.date

    if body.table_id is not None:
        table = await prisma.table.find_unique(where={"id": body.table_id})
        if not table:
            raise HTTPException(status_code=400, detail="table_id does not exist")
        data["tableId"] = body.table_id
        new_table_id = body.table_id

    if body.reservation_time is not None:
        data["date"] = body.reservation_time
        new_date = body.reservation_time

    if body.status is not None:
        data["status"] = body.status

    if body.party_size is not None:
        if body.party_size <= 0:
            raise HTTPException(status_code=400, detail="'party_size' must be positive")
        data["partySize"] = body.party_size

    if body.notes is not None:
        data["notes"] = body.notes

    if not data:
        raise HTTPException(status_code=400, detail="No changes supplied.")

    if ("tableId" in data) or ("date" in data):
        conflict = await prisma.reservation.find_first(
            where={
                "tableId": new_table_id,
                "date": new_date,
                "NOT": {"id": id},
            }
        )
        if conflict:
            raise HTTPException(status_code=409, detail="That table is already booked at that time.")

    updated = await prisma.reservation.update(where={"id": id}, data=data)
    return updated


class StatusUpdate(BaseModel):
    status: ReservationStatus


@router.patch("/{id}/status", response_model=ReservationModel)
async def update_status(id: int, body: StatusUpdate):
    current = await prisma.reservation.find_unique(where={"id": id})
    if not current:
        raise HTTPException(status_code=404, detail="Reservation not found")

    updated = await prisma.reservation.update(where={"id": id}, data={"status": body.status})
    return updated

@router.get("/by-date")  # intentionally no response_model so relations aren't stripped
async def list_reservations_by_date(
    date: str = Query(..., description="YYYY-MM-DD")
):
    """
    All reservations for the given calendar day [start, end),
    including member and table relations.
    """
    try:
        start = datetime.fromisoformat(date)           # naive 00:00:00
        end = start + timedelta(days=1)                # next day 00:00:00

        result = await prisma.reservation.find_many(
            where={"date": {"gte": start, "lt": end}},
            order={"date": "asc"},
            include={
                "member": True,  # id, name, email, phone
                "table": True,   # id, number, capacity
            },
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"step": "by-date", "error": repr(e)})

# --------- Simple ops: daily stats & CSV export ---------

@router.get("/stats")
async def daily_stats(
    date: str = Query(..., description="YYYY-MM-DD"),
):
    try:
        start = datetime.fromisoformat(f"{date}T00:00:00")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    end = start + timedelta(days=1)

    rows = await prisma.reservation.find_many(where={"date": {"gte": start, "lt": end}})
    total = len(rows)
    by_status: Dict[str, int] = {}
    for r in rows:
        s = r.status or "UNKNOWN"
        by_status[s] = by_status.get(s, 0) + 1

    return {
        "date": date,
        "total": total,
        "by_status": by_status,
    }


@router.get("/export.csv")
async def export_csv(
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD (inclusive end date)"),
):
    # inclusive end → convert to range [start, end+1day)
    try:
        start_dt = datetime.fromisoformat(f"{start}T00:00:00")
        end_dt = datetime.fromisoformat(f"{end}T00:00:00") + timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD.")

    rows = await prisma.reservation.find_many(
        where={"date": {"gte": start_dt, "lt": end_dt}},
        order={"date": "asc"},
        include={"member": True, "table": True},
    )

    def iter_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["id", "date", "status", "partySize", "notes", "tableId", "tableNumber",
             "memberId", "memberName", "memberEmail", "memberPhone"]
        )
        yield output.getvalue()
        output.seek(0); output.truncate(0)

        for r in rows:
            writer.writerow([
                r.id,
                r.date.isoformat(),
                r.status,
                r.partySize if r.partySize is not None else "",
                r.notes or "",
                r.tableId,
                (getattr(r.table, "number", None) if r.table else ""),
                r.memberId,
                (getattr(r.member, "name", None) if r.member else ""),
                (getattr(r.member, "email", None) if r.member else ""),
                (getattr(r.member, "phone", None) if r.member else ""),
            ])
            yield output.getvalue()
            output.seek(0); output.truncate(0)

    return StreamingResponse(
        iter_csv(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="reservations_{start}_to_{end}.csv"'
        },
    )
