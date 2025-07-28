'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import RubricBuilder from '@/app/components/RubricBuilder';

interface RubricItem {
  id: string;
  title: string;
  points: number;
  feedback: string;
}

interface RubricPart {
  id: string;
  title: string;
  rubricItems: RubricItem[];
}

interface RubricSection {
  id: string;
  title: string;
  parts?: RubricPart[];
  rubricItems?: RubricItem[];
}

interface GradedItem {
  section: string;
  criterion: string;
  points: number;
  comment: string;
}

interface SubmissionPage {
  id: string;
  image: string;
}

interface SubmissionData {
  id: string;
  studentName: string;
  pages: SubmissionPage[];
  totalScore: number | null;
  gradedAt: string | null;
  feedback: GradedItem[] | null;
  assignment: {
    id: string;
    name: string;
    totalPoints: number;
    rubric: any;
  };
}

export default function ViewGradedSubmission() {
  const params = useParams();
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedRubricItems, setSelectedRubricItems] = useState<{[key: string]: boolean}>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('');
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);
  const [showRubricBuilder, setShowRubricBuilder] = useState(false);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const response = await fetch(`/api/submissions/${params.submissionId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch submission');
        }
        const data = await response.json();
        setSubmission(data);
        
        // Initialize selected rubric items from feedback
        if (data.feedback && data.feedback.length > 0) {
          const initialSelections: {[key: string]: boolean} = {};
          data.feedback.forEach((item: any) => {
            if (item.itemId) {
              initialSelections[item.itemId] = true;
            } else {
              const rubricItem = findRubricItem(item.section, item.criterion, data.assignment.rubric);
              if (rubricItem) initialSelections[rubricItem.id] = true;
            }
          });
          setSelectedRubricItems(initialSelections);
        } else if (data.totalScore === null) {
          // If no feedback and not graded, start with empty selections
          setSelectedRubricItems({});
        }
        
        // Fetch image URLs for all pages
        if (data.pages && data.pages.length > 0) {
          const urls = await Promise.all(
            data.pages.map(async (page: any) => {
              try {
                const imgResponse = await fetch(`/api/submissions/${data.id}/pages/${page.id}`);
                if (imgResponse.ok) {
                  const imgData = await imgResponse.json();
                  return imgData.dataUrl;
                }
                return null;
              } catch (err) {
                console.error('Failed to fetch image:', err);
                return null;
              }
            })
          );
          setImageUrls(urls.filter(url => url !== null));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load submission');
      } finally {
        setLoading(false);
      }
    };

    if (params.submissionId) {
      fetchSubmission();
      fetchAllSubmissions();
    }
  }, [params.submissionId]);

  const convertOldRubricFormat = (rubric: any) => {
    if (!rubric || !rubric.sections) return { sections: [] };
    
    return {
      sections: rubric.sections.map((section: any, sectionIndex: number) => {
        // Convert old criteria to new rubricItems
        const oldCriteria = section.criteria || [];
        const newRubricItems = oldCriteria.map((criterion: any, itemIndex: number) => ({
          id: criterion.id || `item-${sectionIndex}-${itemIndex}`,
          title: criterion.text || `Item ${itemIndex + 1}`,
          points: criterion.points || 0,
          feedback: criterion.comment || ''
        }));

        return {
          id: section.id || `section-${sectionIndex}`,
          title: section.title || `Section ${sectionIndex + 1}`,
          parts: (section.parts || []).map((part: any, partIndex: number) => ({
            ...part,
            id: part.id || `part-${sectionIndex}-${partIndex}`,
            rubricItems: (part.rubricItems || []).map((item: any, itemIndex: number) => ({
              ...item,
              id: item.id || `item-${sectionIndex}-${partIndex}-${itemIndex}`
            }))
          })),
          rubricItems: (section.rubricItems || newRubricItems).map((item: any, itemIndex: number) => ({
            ...item,
            id: item.id || `item-${sectionIndex}-${itemIndex}`
          }))
        };
      })
    };
  };

  const findRubricItem = (sectionTitle: string, criterionText: string, rubric: any) => {
    const convertedRubric = convertOldRubricFormat(rubric);
    
    for (const section of convertedRubric.sections) {
      if (section.title === sectionTitle) {
        // Check section-level items
        if (section.rubricItems) {
          const item = section.rubricItems.find((item: any) => item.title === criterionText);
          if (item) return item;
        }
        
        // Check part-level items
        if (section.parts) {
          for (const part of section.parts) {
            const item = part.rubricItems.find((item: any) => item.title === criterionText);
            if (item) return item;
          }
        }
      }
    }
    return null;
  };

  // Debounced auto-save function
  const debouncedAutoSave = React.useCallback(
    React.useMemo(
      () => {
        let timeoutId: NodeJS.Timeout;
        return (selectedItems: {[key: string]: boolean}) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(async () => {
            try {
              setAutoSaveStatus('Saving...');
              const response = await fetch(`/api/submissions/${submission?.id}/rubric-selections`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selectedItems })
              });
              
              if (response.ok) {
                const result = await response.json();
                setAutoSaveStatus('Auto-saved');
                setTimeout(() => setAutoSaveStatus(''), 2000);
                
                // Update submission data with server response
                if (submission) {
                  setSubmission({
                    ...submission,
                    totalScore: result.totalScore,
                    feedback: result.feedback,
                    gradedAt: new Date().toISOString()
                  });
                  
                  // Notify parent window to refresh submissions list
                  if (window.opener && !window.opener.closed) {
                    window.opener.postMessage({ type: 'SUBMISSION_UPDATED', submissionId: submission.id }, '*');
                  }
                }
              } else {
                setAutoSaveStatus('Save failed');
                setTimeout(() => setAutoSaveStatus(''), 3000);
              }
            } catch (error) {
              console.error('Auto-save error:', error);
              setAutoSaveStatus('Save failed');
              setTimeout(() => setAutoSaveStatus(''), 3000);
            }
          }, 1000); // 1 second debounce
        };
      },
      [submission?.id]
    ),
    [submission?.id]
  );

  // Handle rubric item selection
  const handleRubricItemSelect = (itemId: string, isSelected: boolean) => {
    const newSelections = { ...selectedRubricItems };
    if (isSelected) {
      newSelections[itemId] = true;
    } else {
      delete newSelections[itemId];
    }
    
    setSelectedRubricItems(newSelections);
    
    // Update submission data immediately for UI
    if (submission) {
      const newTotalScore = calculateRunningTotalFromSelections(newSelections);
      setSubmission({
        ...submission,
        totalScore: newTotalScore,
        gradedAt: new Date().toISOString()
      });
    }
    
    debouncedAutoSave(newSelections);
  };

  // Calculate running total from selections
  const calculateRunningTotalFromSelections = (selections: {[key: string]: boolean}) => {
    if (!submission) return 0;
    
    const convertedRubric = convertOldRubricFormat(submission.assignment.rubric);
    let total = 0;
    
    convertedRubric.sections.forEach((section: any) => {
      // Section-level items
      (section.rubricItems || []).forEach((item: any) => {
        if (selections[item.id]) {
          total += item.points;
        }
      });
      
      // Part-level items
      (section.parts || []).forEach((part: any) => {
        part.rubricItems.forEach((item: any) => {
          if (selections[item.id]) {
            total += item.points;
          }
        });
      });
    });
    
    return total;
  };

  // Calculate running total from selected items
  const calculateRunningTotal = () => {
    if (!submission) return 0;
    
    // Use the submission's totalScore if it exists and we haven't made any selections yet
    if (submission.totalScore !== null && Object.keys(selectedRubricItems).length === 0) {
      return submission.totalScore;
    }
    
    // Otherwise calculate from current selections
    const convertedRubric = convertOldRubricFormat(submission.assignment.rubric);
    let total = 0;
    
    convertedRubric.sections.forEach((section: any) => {
      // Section-level items
      (section.rubricItems || []).forEach((item: any) => {
        if (selectedRubricItems[item.id]) {
          total += item.points;
        }
      });
      
      // Part-level items
      (section.parts || []).forEach((part: any) => {
        part.rubricItems.forEach((item: any) => {
          if (selectedRubricItems[item.id]) {
            total += item.points;
          }
        });
      });
    });
    
    return total;
  };

  // Fetch all submissions for navigation
  const fetchAllSubmissions = async () => {
    try {
      const response = await fetch(`/api/assignments/${params.id}/submissions`);
      if (response.ok) {
        const submissions = await response.json();
        setAllSubmissions(submissions);
        
        // Find current submission index
        const currentIndex = submissions.findIndex((s: any) => s.id === params.submissionId);
        setCurrentSubmissionIndex(currentIndex >= 0 ? currentIndex : 0);
      }
    } catch (error) {
      console.error('Error fetching all submissions:', error);
    }
  };

  // Save rubric edits
  const handleSaveRubric = async (newRubric: any) => {
    if (!submission) return;
    try {
      await fetch(`/api/assignments/${submission.assignment.id}/rubric`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rubric: newRubric })
      });
      // Update local state so changes reflect immediately
      setSubmission({
        ...submission,
        assignment: {
          ...submission.assignment,
          rubric: newRubric
        }
      });
      setShowRubricBuilder(false);
    } catch (err) {
      alert('Error saving rubric');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading submission...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#dc2626' }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Submission not found.</p>
      </div>
    );
  }

  const convertedRubric = convertOldRubricFormat(submission.assignment.rubric);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', color: '#e5e7eb' }}>
      {/* Header */}
      <div style={{ 
        background: '#1f2937', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #374151'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', color: '#f9fafb' }}>
              {submission.studentName}'s Submission
            </h1>
            <p style={{ margin: '0 0 8px 0', color: '#d1d5db' }}>
              Assignment: {submission.assignment.name}
            </p>
            <p style={{ margin: 0, color: '#d1d5db' }}>
              Score: {submission.totalScore || 0} / {submission.assignment.totalPoints} points
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: '0 0 4px 0', color: '#d1d5db', fontSize: '14px' }}>
              {submission.gradedAt ? `Graded: ${new Date(submission.gradedAt).toLocaleDateString()}` : 'Not graded yet'}
            </p>
            <button 
              onClick={() => {
                // Navigate back to the assignment page
                // The URL structure is /assignments/[id]/submissions/[submissionId]
                // So params.id gives us the assignment ID
                try {
                  window.location.href = `/assignments/${params.id}`;
                } catch (error) {
                  // Fallback to dashboard if there's an issue
                  window.location.href = '/dashboard';
                }
              }}
              style={{ 
                padding: '8px 16px', 
                background: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
            >
              ← Back to Assignment
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left Column - Submission Images */}
        <div>
          <h2 style={{ margin: '0 0 16px 0', color: '#f9fafb' }}>Submission Pages</h2>
          
          {submission.pages.length > 0 ? (
            <div>
              {/* Image Navigation */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '16px' 
              }}>
                <button 
                  onClick={() => setCurrentImageIndex(Math.max(0, currentImageIndex - 1))}
                  disabled={currentImageIndex === 0}
                  style={{ 
                    padding: '8px 12px', 
                    background: currentImageIndex === 0 ? '#374151' : '#3b82f6', 
                    color: currentImageIndex === 0 ? '#6b7280' : 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: currentImageIndex === 0 ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (currentImageIndex !== 0) {
                      e.currentTarget.style.background = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentImageIndex !== 0) {
                      e.currentTarget.style.background = '#3b82f6';
                    }
                  }}
                >
                  ← Previous
                </button>
                <span style={{ color: '#d1d5db' }}>
                  Page {currentImageIndex + 1} of {submission.pages.length}
                </span>
                <button 
                  onClick={() => setCurrentImageIndex(Math.min(submission.pages.length - 1, currentImageIndex + 1))}
                  disabled={currentImageIndex === submission.pages.length - 1}
                  style={{ 
                    padding: '8px 12px', 
                    background: currentImageIndex === submission.pages.length - 1 ? '#374151' : '#3b82f6', 
                    color: currentImageIndex === submission.pages.length - 1 ? '#6b7280' : 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: currentImageIndex === submission.pages.length - 1 ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (currentImageIndex !== submission.pages.length - 1) {
                      e.currentTarget.style.background = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentImageIndex !== submission.pages.length - 1) {
                      e.currentTarget.style.background = '#3b82f6';
                    }
                  }}
                >
                  Next →
                </button>
              </div>

              {/* Current Image */}
              <div style={{ 
                border: '1px solid #374151', 
                borderRadius: '8px', 
                overflow: 'hidden',
                background: '#111827'
              }}>
                {imageUrls[currentImageIndex] ? (
                  <img 
                    src={imageUrls[currentImageIndex]}
                    alt={`Page ${currentImageIndex + 1}`}
                    style={{ 
                      width: '100%', 
                      height: 'auto', 
                      display: 'block' 
                    }}
                  />
                ) : (
                  <div style={{ 
                    padding: '40px', 
                    textAlign: 'center', 
                    color: '#d1d5db' 
                  }}>
                    Loading image...
                  </div>
                )}
              </div>

              {/* Thumbnail Navigation */}
              {submission.pages.length > 1 && (
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginTop: '16px', 
                  overflowX: 'auto' 
                }}>
                  {submission.pages.map((page, index) => (
                    <button
                      key={page.id}
                      onClick={() => setCurrentImageIndex(index)}
                      style={{
                        padding: '4px',
                        border: currentImageIndex === index ? '2px solid #3b82f6' : '1px solid #374151',
                        borderRadius: '4px',
                        background: currentImageIndex === index ? '#1e3a8a' : '#1f2937',
                        cursor: 'pointer',
                        minWidth: '60px',
                        height: '60px',
                        overflow: 'hidden'
                      }}
                    >
                      {imageUrls[index] ? (
                        <img 
                          src={imageUrls[index]}
                          alt={`Thumbnail ${index + 1}`}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover' 
                          }}
                        />
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          background: '#374151',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8px',
                          color: '#9ca3af'
                        }}>
                          Loading...
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: '#d1d5db', fontStyle: 'italic' }}>
              No submission pages available.
            </p>
          )}
        </div>

        {/* Right Column - Rubric and Feedback */}
        <div>
          {/* Score Summary & Actions */}
          <div style={{ 
            background: '#1f2937', 
            border: '1px solid #374151', 
            borderRadius: '8px', 
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, color: '#f9fafb' }}>Score Summary</h3>
              <div style={{ 
                background: '#059669', 
                color: 'white', 
                padding: '8px 16px', 
                borderRadius: '6px',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                {calculateRunningTotal()} / {submission.assignment.totalPoints}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowRubricBuilder(true)}
                style={{
                  padding: '6px 12px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Edit Rubric
              </button>

              <button
                onClick={async () => {
                  if (!submission) return;
                  try {
                    const resp = await fetch(`/api/submissions/${submission.id}/grade`, { method: 'POST' });
                    if (resp.ok) {
                      window.location.reload();
                    } else {
                      alert('AI re-grade failed');
                    }
                  } catch (err) {
                    console.error(err);
                    alert('AI re-grade error');
                  }
                }}
                style={{
                  padding: '6px 12px',
                  background: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Re-grade with AI
              </button>
            </div>
            {autoSaveStatus && (
              <div style={{ 
                fontSize: '12px', 
                color: autoSaveStatus.includes('failed') ? '#ef4444' : '#10b981',
                textAlign: 'center',
                padding: '4px',
                background: autoSaveStatus.includes('failed') ? '#7f1d1d' : '#064e3b',
                borderRadius: '4px'
              }}>
                {autoSaveStatus}
              </div>
            )}
            {submission.totalScore === null && (
              <button 
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/submissions/${submission.id}/grade`, {
                      method: 'POST'
                    });
                    if (response.ok) {
                      window.location.reload();
                    } else {
                      alert('Failed to grade submission');
                    }
                  } catch (error) {
                    console.error('Error grading submission:', error);
                    alert('Error grading submission');
                  }
                }}
                style={{ 
                  marginTop: '12px',
                  padding: '8px 16px', 
                  background: '#059669', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  width: '100%'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#047857'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#059669'}
              >
                Grade with AI
              </button>
            )}
            {submission.totalScore !== null && (
              <div style={{ 
                marginTop: '12px',
                padding: '8px',
                background: '#1e3a8a',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: '12px', 
                  color: '#93c5fd'
                }}>
                  ✓ Graded - You can edit selections above
                </p>
              </div>
            )}
          </div>

          {/* Rubric Panel */}
          <div style={{ 
            background: '#1f2937', 
            border: '1px solid #374151', 
            borderRadius: '8px', 
            padding: '16px',
            maxHeight: '600px',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f9fafb' }}>Rubric & Feedback</h3>
            
            {convertedRubric.sections.map((section: any, sectionIndex: number) => (
              <div key={section.id} style={{ marginBottom: '20px' }}>
                <h4 style={{ 
                  margin: '0 0 12px 0', 
                  color: '#e5e7eb', 
                  fontSize: '16px',
                  fontWeight: '600',
                  borderBottom: '1px solid #374151',
                  paddingBottom: '8px'
                }}>
                  {section.title}
                </h4>
                
                {/* Section-level items */}
                {(section.rubricItems || []).map((item: any, itemIndex: number) => {
                  const isSelected = selectedRubricItems[item.id] || false;
                  
                  return (
                    <div key={item.id} style={{ 
                      marginBottom: '12px',
                      padding: '12px',
                      border: isSelected ? '2px solid #059669' : '1px solid #374151',
                      borderRadius: '6px',
                      background: isSelected ? '#064e3b' : '#111827',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => handleRubricItemSelect(item.id, !isSelected)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleRubricItemSelect(item.id, !isSelected)}
                            style={{ 
                              margin: 0,
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <h5 style={{ 
                              margin: '0 0 4px 0', 
                              color: isSelected ? '#10b981' : '#f9fafb', 
                              fontSize: '14px',
                              fontWeight: '500'
                            }}>
                              {item.title}
                            </h5>
                            <p style={{ 
                              margin: '0 0 8px 0', 
                              fontSize: '12px', 
                              color: '#d1d5db',
                              fontStyle: 'italic'
                            }}>
                              {item.feedback}
                            </p>
                          </div>
                        </div>
                        <div style={{ 
                          background: isSelected ? '#059669' : '#374151', 
                          color: 'white', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          +{item.points}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Part-level items */}
                {(section.parts || []).map((part: any, partIndex: number) => (
                  <div key={part.id} style={{ marginLeft: '16px', marginBottom: '16px' }}>
                    <h5 style={{ 
                      margin: '0 0 8px 0',
                      fontSize: '14px',
                      color: '#e5e7eb',
                      fontWeight: '500',
                      borderBottom: '1px solid #374151',
                      paddingBottom: '4px'
                    }}>
                      {part.title}
                    </h5>
                    {part.rubricItems.map((item: any, itemIndex: number) => {
                      const isSelected = selectedRubricItems[item.id] || false;
                      
                      return (
                        <div key={item.id} style={{ 
                          marginBottom: '8px',
                          padding: '8px',
                          border: isSelected ? '2px solid #059669' : '1px solid #374151',
                          borderRadius: '4px',
                          background: isSelected ? '#064e3b' : '#111827',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => handleRubricItemSelect(item.id, !isSelected)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleRubricItemSelect(item.id, !isSelected)}
                                style={{ 
                                  margin: 0,
                                  cursor: 'pointer',
                                  transform: 'scale(0.8)'
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <h6 style={{ 
                                  margin: '0 0 4px 0', 
                                  color: isSelected ? '#10b981' : '#f9fafb', 
                                  fontSize: '12px',
                                  fontWeight: '500'
                                }}>
                                  {item.title}
                                </h6>
                                <p style={{ 
                                  margin: '0 0 4px 0', 
                                  fontSize: '11px', 
                                  color: '#d1d5db',
                                  fontStyle: 'italic'
                                }}>
                                  {item.feedback}
                                </p>
                              </div>
                            </div>
                            <div style={{ 
                              background: isSelected ? '#059669' : '#374151', 
                              color: 'white', 
                              padding: '2px 6px', 
                              borderRadius: '3px',
                              fontSize: '10px',
                              fontWeight: '600'
                            }}>
                              +{item.points}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Student Navigation */}
      {allSubmissions.length > 1 && (
        <div style={{ 
          marginTop: '24px',
          padding: '16px',
          background: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ color: '#d1d5db', fontSize: '14px' }}>
            Student {currentSubmissionIndex + 1} of {allSubmissions.length}
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                const prevIndex = Math.max(0, currentSubmissionIndex - 1);
                const prevSubmission = allSubmissions[prevIndex];
                if (prevSubmission) {
                  window.location.href = `/assignments/${params.id}/submissions/${prevSubmission.id}`;
                }
              }}
              disabled={currentSubmissionIndex === 0}
              style={{ 
                padding: '8px 16px',
                background: currentSubmissionIndex === 0 ? '#374151' : '#3b82f6',
                color: currentSubmissionIndex === 0 ? '#6b7280' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentSubmissionIndex === 0 ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentSubmissionIndex !== 0) {
                  e.currentTarget.style.background = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (currentSubmissionIndex !== 0) {
                  e.currentTarget.style.background = '#3b82f6';
                }
              }}
            >
              ← Previous Student
            </button>
            
            <button
              onClick={() => {
                const nextIndex = Math.min(allSubmissions.length - 1, currentSubmissionIndex + 1);
                const nextSubmission = allSubmissions[nextIndex];
                if (nextSubmission) {
                  window.location.href = `/assignments/${params.id}/submissions/${nextSubmission.id}`;
                }
              }}
              disabled={currentSubmissionIndex === allSubmissions.length - 1}
              style={{ 
                padding: '8px 16px',
                background: currentSubmissionIndex === allSubmissions.length - 1 ? '#374151' : '#3b82f6',
                color: currentSubmissionIndex === allSubmissions.length - 1 ? '#6b7280' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentSubmissionIndex === allSubmissions.length - 1 ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (currentSubmissionIndex !== allSubmissions.length - 1) {
                  e.currentTarget.style.background = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (currentSubmissionIndex !== allSubmissions.length - 1) {
                  e.currentTarget.style.background = '#3b82f6';
                }
              }}
            >
              Next Student →
            </button>
          </div>
        </div>
      )}

      {/* Rubric Builder Modal */}
      {showRubricBuilder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px'
          }}>
            <RubricBuilder
              initialRubric={submission.assignment.rubric}
              totalPoints={submission.assignment.totalPoints}
              onSave={handleSaveRubric}
              onCancel={() => setShowRubricBuilder(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
} 