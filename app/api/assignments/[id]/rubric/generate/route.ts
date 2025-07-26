import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const prisma = new PrismaClient();

function computeTotalPoints(rubric: any): number {
  if (!rubric || !rubric.sections) return 0;
  return rubric.sections.reduce((sum: number, sec: any) => {
    return (
      sum +
      (sec.points || 0) +
      (sec.criteria ? sec.criteria.reduce((s: number, c: any) => s + (c.points || 0), 0) : 0)
    );
  }, 0);
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const assignmentId = params.id;
  // @ts-ignore
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let generatedRubric: any = null;
  try {
    // Prepare images as base64
    const images: string[] = [];
    const promptB64 = Buffer.from(assignment.promptImage).toString('base64').replace(/\n/g, '');
    images.push(`data:image/png;base64,${promptB64}`);

    const visionParts = images.flatMap((img, idx) => [
      { type: 'text', text: idx === 0 ? 'Prompt image:' : `Solution image ${idx}` },
      { type: 'image_url', image_url: { url: img } },
    ]);

    const gptResp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `
You are an expert Discrete Math / Probability TA writing detailed, Gradescope-style rubrics **in pure JSON**.

Design requirements:
1. Create one TOP-LEVEL "section" for **each distinct fully-correct solution method** you see in the provided solution image(s).  (e.g., “Multiple-polynomial approach”, “Single-polynomial approach”, etc.)  A student only needs to satisfy ONE section to earn full credit.
2. Inside every section list fine-grained "criteria" that represent the concrete steps, intermediate results, or final answers visible in that method.  Assign points to each criterion so that the section total equals its parent section’s points.
3. Reference ONLY information that is explicitly visible in the solution image.  No guesses, no style/clarity remarks.
4. If the prompt contains *multiple sub-parts* (e.g., “(a) … (b) …”), treat each sub-part as a **disjoint group of criteria** inside the same rubric—label them clearly ("Part (a)", "Part (b)" …).  Points for a part should be awarded only when *all* its criteria for the chosen solution method are satisfied.
5. Use the "alternatives" list when a single criterion can be met by clearly different but correct lines (e.g., using equivalent formulas or numbers).
6. Be maximally specific: include variable names, numeric answers, equation forms, etc., exactly as shown.
7. Distribute the assignment total across sections so that **any one complete solution path earns the full total**.  If you create N alternative sections, each section’s points should equal the assignment total.
8. JSON schema (return **only** this object—no markdown):
{
  "sections": [
    {
      "title": "string",
      "points": int,
      "criteria": [
        {
          "text": "string",            // what the student must show
          "points": int,
          "alternatives": [              // optional alternative phrasings/steps
            { "text": "string" }
          ]
        }
      ]
    }
  ]
}

Ensure the sum of points in every section equals the assignment total (${assignment.totalPoints}).
Return NOTHING except valid JSON.
      `.trim()
        },
        {
          role: 'user',
          content: visionParts as any
        },
        {
          role: 'user',
          content: `The assignment is worth ${assignment.totalPoints} points. Generate a rubric.`
        }
      ],
      max_tokens: 800,
    });

    let raw = gptResp.choices[0].message?.content ?? '';
    // remove markdown fences if present
    raw = raw.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```[a-zA-Z]*\n/, '').replace(/```$/, '').trim();
    }
    // try to parse first JSON block
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }
    generatedRubric = JSON.parse(raw);
  } catch (err) {
    console.error('OpenAI error, falling back to stub', err);
  }

  if (!generatedRubric) {
    generatedRubric = {
      sections: [
        {
          title: 'Overall Correctness',
          points: assignment.totalPoints,
          criteria: [
            { text: 'Matches provided solution', points: assignment.totalPoints, alternatives: [] },
          ],
        },
      ],
    };
  }

  const totalPts = computeTotalPoints(generatedRubric);
  const valid = totalPts === assignment.totalPoints;

  // @ts-ignore
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { rubric: generatedRubric, rubricPoints: totalPts, rubricValid: valid },
  });

  return NextResponse.json({ rubric: generatedRubric, rubricValid: valid });
} 