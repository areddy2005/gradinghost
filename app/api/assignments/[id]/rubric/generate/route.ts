import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const prisma = new PrismaClient();

function computeTotalPoints(rubric: any): number {
  if (!rubric || !rubric.sections) return 0;
  return rubric.sections.reduce((sum: number, section: any) => {
    let sectionTotal = 0;
    
    // Add points from section-level items
    sectionTotal += (section.rubricItems || []).reduce((s: number, item: any) => s + (item.points || 0), 0);
    
    // Add points from part-level items
    sectionTotal += (section.parts || []).reduce((partSum: number, part: any) => {
      return partSum + (part.rubricItems || []).reduce((itemSum: number, item: any) => itemSum + (item.points || 0), 0);
    }, 0);
    
    return sum + sectionTotal;
  }, 0);
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: assignmentId } = await params;
  // @ts-ignore
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let generatedRubric: any = null;
  try {
    // Prepare images as base64 (prompt + all solution images)
    const images: string[] = [];

    // Prompt image (index 0)
    const promptB64 = Buffer.from(assignment.promptImage).toString('base64').replace(/\n/g, '');
    images.push(`data:image/png;base64,${promptB64}`);

    // Fetch solution images for this assignment
    const solutions = await prisma.solution.findMany({
      where: { assignmentId },
      select: { image: true }
    });

    solutions.forEach((sol) => {
      const b64 = Buffer.from(sol.image).toString('base64').replace(/\n/g, '');
      images.push(`data:image/png;base64,${b64}`);
    });

    // Build vision parts for GPT-4o
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
You are an expert Discrete-Math / Probability TA who writes **Gradescope-style rubrics in pure JSON**.

Design requirements
1. Create one top-level **section** for every fully-correct solution path you identify in the solution image(s).
2. For each section provide one of two kinds of rubric items:
   • rubricItems – criteria that belong directly to that section.
   • Optional parts – for prompts that have sub-parts (e.g. “(a), (b) …”). Each part contains its own rubricItems.
3. Every rubric item must reference only work that is **explicitly visible** in the solution image; do not invent style/clarity comments.
4. Give each rubric item a positive points value.  The sum of points in **any single section path** must equal the assignment total (${assignment.totalPoints}).
5. Be maximally specific: include exact numeric answers, equation forms, variable names, etc.
6. JSON schema (return **only** this object – no markdown):

{
  "sections": [
    {
      "title": "string",
      "rubricItems": [
        { "title": "string", "points": int, "feedback": "string" }
      ],
      "parts": [
        {
          "title": "string",
          "rubricItems": [
            { "title": "string", "points": int, "feedback": "string" }
          ]
        }
      ]
    }
  ]
}

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

    // ---- Ensure every element has a stable id field ----
    const addIds = (rubric: any) => {
      if (!rubric || !rubric.sections) return;
      rubric.sections.forEach((sec: any, sIdx: number) => {
        if (!sec.id) sec.id = `section-${sIdx}`;

        // section-level items
        (sec.rubricItems || []).forEach((it: any, iIdx: number) => {
          if (!it.id) it.id = `item-${sIdx}-${iIdx}`;
        });

        // parts and their items
        (sec.parts || []).forEach((part: any, pIdx: number) => {
          if (!part.id) part.id = `part-${sIdx}-${pIdx}`;
          (part.rubricItems || []).forEach((it: any, iIdx: number) => {
            if (!it.id) it.id = `item-${sIdx}-${pIdx}-${iIdx}`;
          });
        });
      });
    };

    addIds(generatedRubric);
  } catch (err) {
    console.error('OpenAI error, falling back to stub', err);
  }

  if (!generatedRubric) {
    generatedRubric = {
      sections: [
        {
          id: 'section-1',
          title: 'Overall Correctness',
          rubricItems: [
            { 
              id: 'item-1', 
              title: 'Matches provided solution', 
              points: assignment.totalPoints, 
              feedback: 'Full credit for correct solution' 
            },
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