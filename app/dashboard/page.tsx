import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  // fetch assignments for this TA
  let assignments: { id: string; name: string; totalPoints: number }[] = [];
  if (session) {
    // @ts-ignore
    const prisma = new PrismaClient();
    // @ts-ignore
    assignments = await prisma.assignment.findMany({
      where: { userId: (session.user as any).userId ?? (session.user as any).id },
      select: { id: true, name: true, totalPoints: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!session) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h1>You are not signed in</h1>
        <Link href="/auth/signin" style={{ color: 'blue' }}>Go to Sign In</Link>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      {/* Sign out top right */}
      <div style={{ position: 'fixed', top: 20, right: 20 }}>
        <Link href="/api/auth/signout" style={{ color: 'blue' }}>Sign Out</Link>
      </div>

      <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>TA Dashboard</h1>

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <Link href="/assignments/new" style={{ padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', borderRadius: 6 }}>Create Assignment</Link>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
        {assignments.map((a) => (
          <Link key={a.id} href={`/assignments/${a.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <img src={`/api/assignments/${a.id}/prompt`} alt={a.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 4, marginBottom: '0.5rem' }} />
              <h3 style={{ margin: 0 }}>{a.name}</h3>
              <p style={{ margin: 0, color: '#555' }}>{a.totalPoints} pts</p>
            </div>
          </Link>
        ))}
        {assignments.length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center' }}>No assignments yet.</p>}
      </section>
    </main>
  );
} 