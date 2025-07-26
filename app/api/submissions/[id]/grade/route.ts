import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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

  // Build minimal images array: prompt + first student page
  const images: string[] = [];
  const promptB64 = Buffer.from(group.assignment.promptImage).toString('base64').replace(/\n/g, '');
  images.push(`data:image/png;base64,${promptB64}`);
  if (group.pages.length > 0) {
    const stuB64 = Buffer.from(group.pages[0].image).toString('base64').replace(/\n/g, '');
    images.push(`data:image/png;base64,${stuB64}`);
  }

  let total = group.assignment.totalPoints;
  let hits: any[] = [];
  try {
    const visionParts = images.flatMap((img, idx) => [
      { type: 'text', text: idx === 0 ? 'Prompt image:' : 'Student answer page:' },
      { type: 'image_url', image_url: { url: img } },
    ]);
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an auto-grader. Using the rubric JSON provided, decide which criteria are satisfied by the student answer. Respond ONLY with JSON of the form {"total":int, "hits":[{"section":"string","criterion":"string","points":int,"comment":"string"}]}.' },
        { role: 'user', content: visionParts as any },
        { role: 'user', content: `Rubric JSON:\n${JSON.stringify(group.assignment.rubric)}` },
        { role: 'user', content: `The exam is worth ${group.assignment.totalPoints} points. Provide grading.` },
      ],
      max_tokens: 400,
    });
    let raw = resp.choices[0].message?.content ?? '';
    raw = raw.trim();
    if (raw.startsWith('```')) raw = raw.replace(/^```[a-zA-Z]*\n/, '').replace(/```$/, '').trim();
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) raw = raw.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(raw);
    if (typeof parsed.total === 'number') total = parsed.total;
    if (Array.isArray(parsed.hits)) hits = parsed.hits;
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