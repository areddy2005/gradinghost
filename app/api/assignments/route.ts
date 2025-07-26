import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const name = formData.get('name') as string | null;
  const totalPointsStr = formData.get('totalPoints') as string | null;
  const promptFile = formData.get('prompt') as File | null;
  const solutionFiles = formData.getAll('solutions') as File[];

  if (!name || !totalPointsStr || !promptFile) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const totalPoints = parseInt(totalPointsStr, 10);
  if (Number.isNaN(totalPoints)) {
    return NextResponse.json({ error: 'Invalid totalPoints' }, { status: 400 });
  }

  // Read prompt image
  const promptBuffer = Buffer.from(await promptFile.arrayBuffer());

  // Create assignment
  const userId = (session.user as any).userId ?? (session.user as any).id;

  const assignment = await prisma.assignment.create({
    data: {
      userId,
      name,
      totalPoints,
      promptImage: promptBuffer,
      solutions: {
        create: [],
      },
    },
  });

  // Insert solutions
  for (const file of solutionFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    await prisma.solution.create({
      data: {
        assignmentId: assignment.id,
        image: buffer,
      },
    });
  }

  return NextResponse.json({ id: assignment.id }, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).userId ?? (session.user as any).id;

  const assignments = await prisma.assignment.findMany({
    where: { userId: userId },
    select: {
      id: true,
      name: true,
      totalPoints: true,
      createdAt: true,
      _count: { select: { solutions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(assignments);
} 