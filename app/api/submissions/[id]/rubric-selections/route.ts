import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

// Helper: convert old rubric (criteria) into hierarchical format and generate fallback IDs so that they
// match the IDs produced on the client (e.g. item-0-0, item-0-1, item-0-0-0 etc.).
function normalizeRubric(raw: any) {
  if (!raw || !raw.sections) return { sections: [] };

  return {
    sections: raw.sections.map((section: any, sectionIdx: number) => {
      const oldCriteria = section.criteria || [];
      const newRubricItems = oldCriteria.map((c: any, idx: number) => ({
        id: c.id || `item-${sectionIdx}-${idx}`,
        title: c.text || `Item ${idx + 1}`,
        points: c.points || 0,
        feedback: c.comment || ''
      }));

      return {
        id: section.id || `section-${sectionIdx}`,
        title: section.title || `Section ${sectionIdx + 1}`,
        rubricItems: (section.rubricItems || newRubricItems).map((it: any, idx: number) => ({
          ...it,
          id: it.id || `item-${sectionIdx}-${idx}`
        })),
        parts: (section.parts || []).map((part: any, partIdx: number) => ({
          ...part,
          id: part.id || `part-${sectionIdx}-${partIdx}`,
          rubricItems: (part.rubricItems || []).map((it: any, idx: number) => ({
            ...it,
            id: it.id || `item-${sectionIdx}-${partIdx}-${idx}`
          }))
        }))
      };
    })
  };
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: submissionId } = await ctx.params;

  try {
    const { selectedItems } = await req.json();

    // Calculate total score from selected items
    const submission = await prisma.submissionGroup.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          select: {
            rubric: true
          }
        }
      }
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Convert rubric so IDs match what the client generates
    const normalized = normalizeRubric(submission.assignment.rubric);

    const feedback: any[] = [];
    let totalScore = 0;

    normalized.sections.forEach((section: any) => {
      // Section-level items
      (section.rubricItems || []).forEach((item: any) => {
        if (selectedItems[item.id]) {
          feedback.push({
            section: section.title,
            criterion: item.title,
            points: item.points,
            comment: 'Manually selected by TA'
          });
          totalScore += item.points;
        }
      });

      // Part-level items
      (section.parts || []).forEach((part: any) => {
        (part.rubricItems || []).forEach((item: any) => {
          if (selectedItems[item.id]) {
            feedback.push({
              section: section.title,
              criterion: item.title,
              points: item.points,
              comment: 'Manually selected by TA'
            });
            totalScore += item.points;
          }
        });
      });
    });

    // Update submission with new feedback and score
    await prisma.submissionGroup.update({
      where: { id: submissionId },
      data: {
        feedback: feedback,
        totalScore: totalScore,
        gradedAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true, 
      totalScore,
      feedback 
    });
  } catch (error) {
    console.error('Error updating rubric selections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 