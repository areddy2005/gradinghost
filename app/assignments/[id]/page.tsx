'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface RubricResponse {
  id: string;
  name: string;
  totalPoints: number;
  rubric: any;
  rubricValid: boolean;
  rubricPoints: number;
}

export default function AssignmentDetail() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [data, setData] = useState<RubricResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [jsonText, setJsonText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [subs, setSubs] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch(`/api/assignments/${id}`);
    const json = await res.json();
    setData(json);
    setJsonText(JSON.stringify(json.rubric ?? {}, null, 2));
    setLoading(false);
  };

  const fetchSubs = async () => {
    const res = await fetch(`/api/assignments/${id}/submissions`);
    const j = await res.json();
    setSubs(j);
  };

  useEffect(() => {
    fetchData();
    fetchSubs();
  }, []);

  const handleGenerate = async () => {
    setMsg('Generating…');
    await fetch(`/api/assignments/${id}/rubric/generate`, { method: 'POST' });
    await fetchData();
    setMsg(null);
  };

  const handleSave = async () => {
    let rubric;
    try {
      rubric = JSON.parse(jsonText);
    } catch {
      setMsg('Invalid JSON');
      return;
    }
    setMsg('Saving…');
    await fetch(`/api/assignments/${id}/rubric`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rubric }),
    });
    await fetchData();
    setMsg(null);
  };

  const grade = async (subId: string) => {
    const res = await fetch(`/api/submissions/${subId}/grade`, { method: 'POST' });
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j.hits) && j.hits.length > 0) {
        const lines = j.hits.map((h: any) => `• [${h.section}] ${h.criterion} (+${h.points})\n  ${h.comment || ''}`).join('\n');
        alert(`Feedback:\n${lines}`);
      }
    }
    fetchSubs();
  };

  if (loading) return <p style={{ textAlign: 'center', marginTop: '2rem' }}>Loading…</p>;
  if (!data) return <p>Error</p>;

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <a href="/dashboard" style={{ marginBottom: '1rem', display: 'inline-block' }}>← Back to Dashboard</a>
      <h1>{data.name}</h1>
      <p>Total Points: {data.totalPoints}</p>
      <img src={`/api/assignments/${id}/prompt`} alt="prompt" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', marginBottom: '1rem' }} />

      <Link href={`/assignments/${id}/upload`} style={{ padding: '0.5rem 1rem', background: '#15803d', color: 'white', borderRadius: 6, display: 'inline-block', marginBottom: '1rem' }}>
        Upload Student Submission
      </Link>

      {!data.rubric && (
        <button onClick={handleGenerate} style={{ padding: '0.5rem 1rem' }}>Generate Rubric</button>
      )}

      {data.rubric && (
        <>
          <h2>Rubric (hierarchical view)</h2>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem' }}>
            {data.rubric.sections?.map((sec: any, idx: number) => (
              <li key={idx} style={{ marginBottom: '0.5rem' }}>
                <strong>{sec.title}</strong> – {sec.points} pts
                {sec.criteria && (
                  <ul style={{ listStyleType: 'circle', paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                    {sec.criteria.map((c: any, j: number) => (
                      <li key={j}>
                        {c.text} – {c.points} pts
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {/* Editable JSON textarea for TA modifications */}
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={12}
            style={{ width: '100%', fontFamily: 'monospace', marginTop: '1rem' }}
          />

          <div style={{ marginTop: '1rem' }}>
            <button onClick={handleSave} style={{ padding: '0.5rem 1rem', marginRight: '1rem' }}>Save</button>
            <button onClick={handleGenerate} style={{ padding: '0.5rem 1rem' }}>Regenerate Rubric</button>
          </div>
        </>
      )}
      {msg && <p>{msg}</p>}

      <h2 style={{ marginTop: '2rem' }}>Submissions</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Student</th>
            <th>Pages</th>
            <th>Score</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id} style={{ borderTop: '1px solid #ddd' }}>
              <td>{s.studentName}</td>
              <td style={{ textAlign: 'center' }}>{s._count.pages}</td>
              <td style={{ textAlign: 'center' }}>{s.totalScore ?? '—'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {!s.totalScore && (
                  <button onClick={() => grade(s.id)} style={{ padding: '0.25rem 0.5rem', marginRight: 4 }}>Grade</button>
                )}
                {s.feedback && (
                  <button
                    onClick={() => {
                      const lines = s.feedback.map((h: any) => `• [${h.section}] ${h.criterion} (+${h.points})\n  ${h.comment || ''}`).join('\n');
                      alert(`Feedback for ${s.studentName}:\n${lines}`);
                    }}
                    style={{ padding: '0.25rem 0.5rem', marginRight: 4 }}
                  >
                    View Feedback
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!confirm(`Delete submission for ${s.studentName}?`)) return;
                    await fetch(`/api/submissions/${s.id}`, { method: 'DELETE' });
                    fetchSubs();
                  }}
                  style={{ padding: '0.25rem 0.5rem', background: '#b91c1c', color: '#fff' }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {subs.length === 0 && (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '1rem' }}>No submissions yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
} 