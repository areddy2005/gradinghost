'use client';

import { signIn } from 'next-auth/react';
import React from 'react';

export default function SignInPage() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1>Sign in to TA Portal</h1>
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        style={{ padding: '0.5rem 1rem', fontSize: '1rem', cursor: 'pointer', marginTop: '1rem' }}
      >
        Sign in with Google
      </button>
    </main>
  );
} 