'use client';

import { useSearchParams } from 'next/navigation';
import React from 'react';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1>Authentication Error</h1>
      <p>{error === 'AccessDenied' ? 'Access denied: You must use a @berkeley.edu account.' : 'An error occurred during sign-in.'}</p>
      <a href="/auth/signin" style={{ marginTop: '1rem', color: 'blue' }}>Back to sign in</a>
    </main>
  );
} 