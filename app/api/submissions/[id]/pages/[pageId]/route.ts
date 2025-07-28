import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
// @ts-ignore
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; pageId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: submissionId, pageId } = await ctx.params;
  
  try {
    // @ts-ignore
    const page = await prisma.submissionPage.findFirst({
      where: { 
        id: pageId,
        groupId: submissionId
      },
      select: {
        image: true
      }
    });

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Convert the image buffer to base64 and return as data URL
    const base64Image = Buffer.from(page.image).toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return NextResponse.json({ dataUrl });
  } catch (error) {
    console.error('Error fetching submission page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 