import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: assignmentId } = await ctx.params;
  // @ts-ignore
  const groups = await prisma.submissionGroup.findMany({
    where: { assignmentId },
    select: {
      id: true,
      studentName: true,
      _count: { select: { pages: true } },
      // @ts-ignore
      totalScore: true,
      feedback: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(groups);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: assignmentId } = await ctx.params;
  const form = await req.formData();
  const studentName = form.get('studentName') as string | null;
  const files = form.getAll('pages') as File[];
  if (!studentName || files.length === 0) {
    return NextResponse.json({ error: 'studentName and pages required' }, { status: 400 });
  }

  // check duplicate
  // @ts-ignore
  const existing = await prisma.submissionGroup.findUnique({
    where: { assignmentId_studentName: { assignmentId, studentName } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Duplicate student name for this assignment' }, { status: 409 });
  }

  // create group
  // @ts-ignore
  const group = await prisma.submissionGroup.create({
    data: {
      assignmentId,
      studentName,
      pages: {
        create: [],
      },
    },
  });

  // insert pages
  for (const f of files) {
    const buffer = Buffer.from(await f.arrayBuffer());
    // @ts-ignore
    await prisma.submissionPage.create({
      data: { groupId: group.id, image: buffer },
    });
  }
  return NextResponse.json({ id: group.id }, { status: 201 });
} 