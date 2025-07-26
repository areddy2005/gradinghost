import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '../../auth/[...nextauth]/route';

const prisma = new PrismaClient();

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = ctx.params; // accessed after first await

  // @ts-ignore
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      totalPoints: true,
      rubric: true,
      rubricValid: true,
      rubricPoints: true,
    },
  });
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(assignment);
} 