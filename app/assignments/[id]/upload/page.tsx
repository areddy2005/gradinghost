'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function UploadSubmissionPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [studentName, setStudentName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const onFiles = (fs: FileList | null) => {
    if (!fs) return;
    setFiles(Array.from(fs));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || files.length === 0) {
      setMsg('Name and pages required');
      return;
    }
    const fd = new FormData();
    fd.append('studentName', studentName.trim());
    files.forEach((f) => fd.append('pages', f));
    setMsg('Uploading…');
    const res = await fetch(`/api/assignments/${id}/submissions`, { method: 'POST', body: fd });
    if (res.ok) {
      router.push(`/assignments/${id}`);
    } else {
      const j = await res.json();
      setMsg(j.error || 'Error');
    }
  };

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <a href={`/assignments/${id}`} style={{ display: 'inline-block', marginBottom: '1rem' }}>← Back</a>
      <h1>Upload Submission</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Student Name
          <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '1rem' }} />
        </label>
        <label>
          Pages (images)
          <input type="file" multiple accept="image/*" onChange={(e) => onFiles(e.target.files)} style={{ display: 'block', marginTop: '0.5rem', marginBottom: '1rem' }} />
        </label>
        {files.length > 0 && (
          <ul>
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}
        {msg && <p>{msg}</p>}
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Upload</button>
      </form>
    </main>
  );
} 