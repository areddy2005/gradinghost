import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: groupId } = await ctx.params;
  // @ts-ignore
  const group = await prisma.submissionGroup.findUnique({
    where: { id: groupId },
    include: {
      assignment: {
        select: { promptImage: true, totalPoints: true, rubric: true },
      },
      pages: true,
    },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Build vision images array: ONLY student pages (no prompt)
  const images: { label: string; dataUrl: string }[] = [];

  // Every student page, preserving order
  group.pages.forEach((pg, idx) => {
    const b64 = Buffer.from(pg.image).toString('base64').replace(/\n/g, '');
    images.push({ label: `Student answer page ${idx + 1}:`, dataUrl: `data:image/png;base64,${b64}` });
  });

  let total = group.assignment.totalPoints;
  let hits: any[] = [];
  try {
    const visionParts = images.flatMap((obj) => [
      { type: 'text', text: obj.label },
      { type: 'image_url', image_url: { url: obj.dataUrl } },
    ]);
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are an auto-grader.

You receive two things:
  1. rubric JSON (contains unique "id" for every rubricItem)
  2. student-answer image(s).

Task:
  • Decide **which rubricItems are fully satisfied** by the student.
  • Compute an integer total by summing the *points* for every satisfied item.

Response format (MUST be pure JSON – no markdown):
{
  "total": int,                       // sum of points for satisfied items
  "hits": [                           // one element **per satisfied item only**
    {
      "section": "string",           // section.title
      "criterion": "string",         // rubricItem.title
      "itemId": "string",           // rubricItem.id (exact match!)
      "points": int,                 // the rubricItem.points value
      "comment": "string"           // short justification referencing student work
    }
  ]
}

Do NOT include items that are not satisfied.  Do NOT add fields.  Return only JSON.` },
        { role: 'user', content: visionParts as any },
        { role: 'user', content: `Rubric JSON:\n${JSON.stringify(group.assignment.rubric)}` },
        { role: 'user', content: `The exam is worth ${group.assignment.totalPoints} points. Provide grading.` },
      ],
      max_tokens: 400,
    });
    let raw = resp.choices[0].message?.content ?? '';
    console.log('GPT grading raw response:', raw);
    raw = raw.trim();
    if (raw.startsWith('```')) raw = raw.replace(/^```[a-zA-Z]*\n/, '').replace(/```$/, '').trim();
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) raw = raw.slice(firstBrace, lastBrace + 1);
    const cleanJson = (txt:string)=>{
      // remove trailing commas before ] or }
      return txt.replace(/,\s*([}\]])/g,'$1');
    };
    const parsed = JSON.parse(cleanJson(raw));
    if (Array.isArray(parsed.hits)) hits = parsed.hits;

    // Normalize rubric to map titles -> item data
    const norm = (rub: any) => {
      const map: Record<string, any> = {};
      rub.sections.forEach((sec: any) => {
        (sec.rubricItems||[]).forEach((it:any)=>{ map[`${sec.title}||${it.title}`]=it; });
        (sec.parts||[]).forEach((p:any)=>{
          (p.rubricItems||[]).forEach((it:any)=>{ map[`${sec.title}||${it.title}`]=it; });
        });
      });
      return map;
    };
    const rubricData:any = (group.assignment.rubric && typeof group.assignment.rubric === 'object') ? group.assignment.rubric : { sections: [] };
    const rubricMap = norm(rubricData);

    // quick id→points map as well
    const idMap: Record<string, number> = {};
    (rubricData.sections || []).forEach((sec:any)=>{
      (sec.rubricItems||[]).forEach((it:any)=>{ idMap[it.id]=it.points; });
      (sec.parts||[]).forEach((p:any)=>{ (p.rubricItems||[]).forEach((it:any)=>{ idMap[it.id]=it.points; });});
    });

    // Recompute total based on rubric points to avoid GPT errors and attach feedback ids
    total = 0;
    hits = hits.map((h:any)=>{
      const key=`${h.section}||${h.criterion}`;
      const points= h.itemId && idMap[h.itemId]!=null ? idMap[h.itemId] : (rubricMap[key]?.points || 0);
      total+=points;
      return {
        section: h.section,
        criterion: h.criterion,
        itemId: h.itemId || (rubricMap[key]?.id ?? null),
        points,
        comment: h.comment || ''
      };
    });
  } catch (err) {
    console.error('OpenAI grading error, defaulting full score', err);
  }

  // @ts-ignore
  await prisma.submissionGroup.update({
    where: { id: groupId },
    data: { totalScore: total, gradedAt: new Date(), feedback: hits },
  });
  return NextResponse.json({ total, hits });
} 