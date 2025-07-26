'use client';

import React, { useState, DragEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function NewAssignmentPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [totalPoints, setTotalPoints] = useState('');
  const [promptFile, setPromptFile] = useState<File | null>(null);
  const [solutionFiles, setSolutionFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSolutionsChange = (files: FileList | null) => {
    if (!files) return;
    setSolutionFiles(Array.from(files));
  };

  const handleDropSolutions = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onSolutionsChange(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Assignment name is required');
      return;
    }
    if (!totalPoints.trim()) {
      setError('Total point value is required');
      return;
    }
    const pointsNum = parseInt(totalPoints, 10);
    if (Number.isNaN(pointsNum) || pointsNum <= 0) {
      setError('Total point value must be a positive integer');
      return;
    }
    if (!promptFile) {
      setError('Prompt image is required');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('totalPoints', totalPoints);
    formData.append('prompt', promptFile);
    solutionFiles.forEach((file) => formData.append('solutions', file));

    setSubmitting(true);
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Create New Assignment</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Assignment Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ display: 'block', width: '100%', padding: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Total Points
            <input
              type="number"
              value={totalPoints}
              onChange={(e) => setTotalPoints(e.target.value)}
              style={{ display: 'block', width: '100%', padding: '0.5rem' }}
              min={1}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Prompt Image (single)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPromptFile(e.target.files ? e.target.files[0] : null)}
              style={{ display: 'block', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropSolutions}
          style={{ marginBottom: '1rem', padding: '1rem', border: '2px dashed #888', borderRadius: 8 }}
        >
          <label>
            Solution Images (one or more)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onSolutionsChange(e.target.files)}
              style={{ display: 'block', marginTop: '0.5rem' }}
            />
          </label>
          <p style={{ marginTop: '0.5rem', color: '#666' }}>Drag and drop files here or click to select.</p>
          {solutionFiles.length > 0 && (
            <ul>
              {solutionFiles.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          )}
        </div>
        {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: '0.75rem 1.5rem' }}>
          {submitting ? 'Uploading…' : 'Create Assignment'}
        </button>
      </form>
    </main>
  );
} 