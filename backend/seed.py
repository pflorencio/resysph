import asyncio
from prisma_client import Prisma


async def main():
    db = Prisma()
    await db.connect()

    print("🌱 Seeding database...")

    # Seed Restaurant
    restaurant = await db.restaurant.create(
        data={
            "name": "Nonie's Boracay",
            "location": "Station 2, Boracay",
        }
    )

    # Seed Floor
    floor = await db.floor.create(
        data={
            "name": "Main Dining",
            "restaurant": {
                "connect": {"id": restaurant.id}
            }
        }
    )

    # Seed Tables
    table1 = await db.table.create(
        data={
            "number": 1,
            "capacity": 4,
            "floor": {
                "connect": {"id": floor.id}
            }
        }
    )

    table2 = await db.table.create(
        data={
            "number": 2,
            "capacity": 2,
            "floor": {
                "connect": {"id": floor.id}
            }
        }
    )

    # Seed Member
    member = await db.member.create(
        data={
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "+639171234567"
        }
    )

    # Seed Reservation (note: using "date" not "datetime", and no "status")
    await db.reservation.create(
        data={
            "table": {
                "connect": {"id": table1.id}
            },
            "member": {
                "connect": {"id": member.id}
            },
            "date": "2025-09-01T18:30:00+08:00"
        }
    )

    print("✅ Seeding complete.")
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
