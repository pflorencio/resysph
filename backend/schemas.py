# backend/schemas.py
from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator


# -------------------------
# Member Schema
# -------------------------

class MemberCreate(BaseModel):
    """
    Accept either:
      { "name": "Test User", "email": "...", "phone": "..." }
    or:
      { "first_name": "Test", "last_name": "User", "email": "...", "phone": "..." }
    Normalize to a single `name` string for DB writes.
    """
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    email: EmailStr
    phone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="after")
    def normalize_name(self) -> "MemberCreate":
        # Require either combined `name` or both first+last
        if not self.name and not (self.first_name and self.last_name):
            raise ValueError("Provide either 'name' or both 'first_name' and 'last_name'.")

        # If only first/last provided, build the single `name`
        if not self.name:
            self.name = f"{self.first_name.strip()} {self.last_name.strip()}".strip()

        return self


# -------------------------
# Reservation Schema
# -------------------------

class ReservationCreate(BaseModel):
    """
    - Accepts either `reservation_time` or legacy key `datetime`.
    - If no member_id, require `name` and `email` for contact.
    """
    restaurant_id: Optional[int] = None
    floor_id: Optional[int] = None
    table_id: Optional[int] = None
    member_id: Optional[int] = None

    # contact details (used when member_id is not provided)
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    party_size: int

    reservation_time: datetime = Field(validation_alias="datetime")
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @model_validator(mode="after")
    def validate_contact_or_member(self) -> "ReservationCreate":
        if self.member_id is None:
            if not self.name or not self.email:
                raise ValueError("When 'member_id' is not provided, both 'name' and 'email' are required.")
        return self
