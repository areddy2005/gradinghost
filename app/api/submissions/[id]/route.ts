import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: submissionId } = await ctx.params;
  
  try {
    // @ts-ignore
    const submission = await prisma.submissionGroup.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: {
            id: true,
            name: true,
            totalPoints: true,
            rubric: true
          }
        },
        pages: {
          select: {
            id: true
          }
        }
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: submission.id,
      studentName: submission.studentName,
      pages: submission.pages,
      totalScore: submission.totalScore,
      gradedAt: submission.gradedAt,
      feedback: submission.feedback,
      assignment: submission.assignment
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: submissionId } = await ctx.params;
  
  try {
    // @ts-ignore
    await prisma.submissionGroup.delete({
      where: { id: submissionId }
    });

    return NextResponse.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 