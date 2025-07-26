import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>TA Portal</h1>
      {session ? (
        <div>
          <p>Welcome, {session.user?.email}</p>
          <Link href="/api/auth/signout" style={{ color: 'blue' }}>Sign Out</Link>
        </div>
      ) : (
        <div>
          <p>You are not signed in.</p>
          <Link href="/auth/signin" style={{ color: 'blue' }}>Sign In</Link>
        </div>
      )}
      </main>
  );
}
