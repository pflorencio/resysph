import { NextResponse } from 'next/server'
import { prisma } from 'frontend/src/lib/prisma'

// GET /api/reservations
export async function GET() {
  const data = await prisma.reservation.findMany({
    where: {
      isDeleted: false,
    },
    orderBy: {
      startsAt: 'asc',
    },
    include: {
      table: {
        select: { label: true },
      },
    },
    take: 25,
  })

  return NextResponse.json(data)
}
