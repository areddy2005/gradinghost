import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // @ts-ignore - Prisma client delegate
  const assignment = await prisma.assignment.findUnique({
    where: { id: params.id },
    select: { promptImage: true },
  });

  if (!assignment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(assignment.promptImage, {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  });
} 