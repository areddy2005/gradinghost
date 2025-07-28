import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

// Ensure every section, part, and rubricItem has a deterministic id so
// downstream GPT calls can reference them.
function ensureIds(rubric: any) {
  if (!rubric?.sections) return;
  rubric.sections.forEach((sec: any, sIdx: number) => {
    if (!sec.id) sec.id = `section-${sIdx}`;

    // section-level items
    (sec.rubricItems || []).forEach((it: any, iIdx: number) => {
      if (!it.id) it.id = `item-${sIdx}-${iIdx}`;
    });

    // nested parts + items
    (sec.parts || []).forEach((p: any, pIdx: number) => {
      if (!p.id) p.id = `part-${sIdx}-${pIdx}`;
      (p.rubricItems || []).forEach((it: any, iIdx: number) => {
        if (!it.id) it.id = `item-${sIdx}-${pIdx}-${iIdx}`;
      });
    });
  });
}

function computeTotal(rubric: any): number {
  if (!rubric || !rubric.sections) return 0;
  return rubric.sections.reduce((sum: number, sec: any) => {
    let sectionTotal = 0;
    sectionTotal += (sec.rubricItems || []).reduce((s: number, it: any) => s + (it.points || 0), 0);
    sectionTotal += (sec.parts || []).reduce((partSum: number, part: any) => {
      return partSum + (part.rubricItems || []).reduce((itSum: number, it: any) => itSum + (it.points || 0), 0);
    }, 0);
    return sum + sectionTotal;
  }, 0);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: assignmentId } = await params;
  const body = await request.json();
  const rubric = body.rubric;

  // add ids if missing
  ensureIds(rubric);

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