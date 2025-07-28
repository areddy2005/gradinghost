'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function UploadSubmissionPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [studentName, setStudentName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onFiles = (fs: FileList | null) => {
    if (!fs) return;
    const newFiles = Array.from(fs);
    setFiles(prev => {
      // avoid duplicate names
      const existingNames = new Set(prev.map(f => f.name));
      const merged = [...prev, ...newFiles.filter(f => !existingNames.has(f.name))];
      return merged;
    });
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
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => onFiles(e.target.files)}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '0.4rem 0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, marginBottom: '1rem', cursor: 'pointer' }}
        >
          + Add Page(s)
        </button>

        {files.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h4>Pages to upload ({files.length})</h4>
            <ul style={{ listStyle:'none', padding:0 }}>
              {files.map((f, idx) => (
                <li key={idx} style={{ display:'flex', alignItems:'center', marginBottom:'0.25rem' }}>
                  <span style={{ flex:1 }}>{f.name}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_,i)=>i!==idx))} style={{ background:'#b91c1c', color:'#fff', border:'none', borderRadius:4, padding:'0.2rem 0.5rem', cursor:'pointer' }}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {msg && <p>{msg}</p>}
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Upload</button>
      </form>
    </main>
  );
} 