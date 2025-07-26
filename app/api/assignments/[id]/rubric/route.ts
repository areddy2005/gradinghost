import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

function computeTotal(rubric: any): number {
  if (!rubric || !rubric.sections) return 0;
  return rubric.sections.reduce((sum: number, sec: any) => {
    const critSum = sec.criteria ? sec.criteria.reduce((s: number, c: any) => s + (c.points || 0), 0) : 0;
    return sum + (sec.points || 0) + critSum;
  }, 0);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: assignmentId } = await params;
  const body = await request.json();
  const rubric = body.rubric;

  if (!rubric) return NextResponse.json({ error: 'Rubric required' }, { status: 400 });

  // @ts-ignore
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const totalPts = computeTotal(rubric);
  const valid = totalPts === assignment.totalPoints;

  // @ts-ignore
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { rubric, rubricPoints: totalPts, rubricValid: valid },
  });

  return NextResponse.json({ rubricValid: valid, rubricPoints: totalPts });
} 