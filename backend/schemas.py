from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, EmailStr, Field, AliasChoices, model_validator


# -------------------------
# Member Schema
# -------------------------

class MemberCreate(BaseModel):
    # Accept either a single "name" or first/last (we'll normalize to .name)
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    email: EmailStr
    phone: str

    model_config = {
        "populate_by_name": True,
    }

    @model_validator(mode="after")
    def _normalize_name(self):
        if self.name and self.name.strip():
            self.name = self.name.strip()
            return self
        parts = []
        if self.first_name:
            parts.append(self.first_name.strip())
        if self.last_name:
            parts.append(self.last_name.strip())
        if parts:
            self.name = " ".join(p for p in parts if p).strip()
        if not self.name:
            raise ValueError("Provide either 'name' or 'first_name'/'last_name'.")
        return self


# -------------------------
# Reservation Schema
# -------------------------

ReservationStatus = Literal[
    "PENDING", "CONFIRMED", "SEATED", "COMPLETED", "CANCELLED", "NO_SHOW"
]


class ReservationCreate(BaseModel):
    # Primary inputs
    table_id: int = Field(validation_alias=AliasChoices("table_id", "tableId"))
    member_id: Optional[int] = Field(
        default=None, validation_alias=AliasChoices("member_id", "memberId")
    )
    # Accept "reservation_time" or "date"/"datetime"; Pydantic will parse ISO strings
    reservation_time: datetime = Field(
        validation_alias=AliasChoices("reservation_time", "date", "datetime")
    )

    # New optional fields aligned with Prisma
    status: Optional[ReservationStatus] = None
    party_size: Optional[int] = Field(
        default=None, validation_alias=AliasChoices("party_size", "partySize")
    )
    notes: Optional[str] = None

    # For auto-create member path (when member_id is None)
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    model_config = {
        "populate_by_name": True,
    }

    @model_validator(mode="after")
    def _conditional_member_requirements(self):
        # If we are not given an existing member_id, email & phone must be present to create/reuse member
        if self.member_id is None:
            if not self.email or not self.phone:
                raise ValueError(
                    "When 'member_id' is not provided, both 'email' and 'phone' are required."
                )
        # Optional: enforce positive party size if provided
        if self.party_size is not None and self.party_size <= 0:
            raise ValueError("'party_size' must be a positive integer.")
        return self
