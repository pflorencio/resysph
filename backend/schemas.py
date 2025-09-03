from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# -------------------------
# Member Schema
# -------------------------

class MemberCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr


# -------------------------
# Reservation Schema
# -------------------------

class ReservationCreate(BaseModel):
    member_id: str
    table_id: str
    datetime: datetime
    party_size: int
    notes: Optional[str] = None
