'use client';

import React, { useState } from 'react';

interface RubricDisplayProps {
  rubric: any;
  totalPoints: number;
}

export default function RubricDisplay({ rubric, totalPoints }: RubricDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const togglePart = (partId: string) => {
    const newExpanded = new Set(expandedParts);
    if (newExpanded.has(partId)) {
      newExpanded.delete(partId);
    } else {
      newExpanded.add(partId);
    }
    setExpandedParts(newExpanded);
  };

  const calculateTotalPoints = () => {
    // Convert old format to new format for calculation
    const convertedRubric = {
      sections: rubric.sections.map((section: any, sectionIndex: number) => {
        const oldCriteria = section.criteria || [];
        const newRubricItems = oldCriteria.map((criterion: any, itemIndex: number) => ({
          id: `item-${sectionIndex}-${itemIndex}`,
          title: criterion.text || `Item ${itemIndex + 1}`,
          points: criterion.points || 0,
          feedback: criterion.comment || ''
        }));

        return {
          id: section.id || `section-${sectionIndex}`,
          title: section.title || `Section ${sectionIndex + 1}`,
          parts: section.parts || [],
          rubricItems: section.rubricItems || newRubricItems
        };
      })
    };

    return convertedRubric.sections.reduce((total: number, section: any) => {
      let sectionTotal = 0;
      
      // Add points from section-level items
      sectionTotal += (section.rubricItems || []).reduce((sum: number, item: any) => sum + (item.points || 0), 0);
      
      // Add points from part-level items
      sectionTotal += (section.parts || []).reduce((partSum: number, part: any) => {
        return partSum + (part.rubricItems || []).reduce((itemSum: number, item: any) => itemSum + (item.points || 0), 0);
      }, 0);
      
      return total + sectionTotal;
    }, 0);
  };

  if (!rubric || !rubric.sections) {
    return <p>No rubric available.</p>;
  }

  // Convert old format to new format for display
  const convertedRubric = {
    sections: rubric.sections.map((section: any, sectionIndex: number) => {
      // Convert old criteria to new rubricItems
      const oldCriteria = section.criteria || [];
      const newRubricItems = oldCriteria.map((criterion: any, itemIndex: number) => ({
        id: `item-${sectionIndex}-${itemIndex}`,
        title: criterion.text || `Item ${itemIndex + 1}`,
        points: criterion.points || 0,
        feedback: criterion.comment || ''
      }));

      return {
        id: section.id || `section-${sectionIndex}`,
        title: section.title || `Section ${sectionIndex + 1}`,
        parts: section.parts || [],
        rubricItems: section.rubricItems || newRubricItems
      };
    })
  };

  const totalAssignedPoints = calculateTotalPoints();

  return (
    <div className="rubric-display" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ 
        background: '#f8fafc', 
        padding: '16px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #e2e8f0'
      }}>
        <h3 style={{ margin: 0, color: '#1e293b' }}>Rubric Overview</h3>
        <p style={{ margin: '8px 0 0 0', color: '#64748b' }}>
          Total Points: {totalAssignedPoints} / {totalPoints} | Sections: {convertedRubric.sections.length}
        </p>
      </div>

      {convertedRubric.sections.map((section: any, sectionIndex: number) => {
        const sectionId = `section-${sectionIndex}`;
        const isExpanded = expandedSections.has(sectionId);
        
        // Calculate section points
        const sectionItemsPoints = (section.rubricItems || []).reduce((sum: number, item: any) => sum + (item.points || 0), 0);
        const partsPoints = (section.parts || []).reduce((partSum: number, part: any) => {
          return partSum + (part.rubricItems || []).reduce((itemSum: number, item: any) => itemSum + (item.points || 0), 0);
        }, 0);
        const totalSectionPoints = sectionItemsPoints + partsPoints;

        return (
          <div key={sectionId} style={{ 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px', 
            marginBottom: '12px',
            overflow: 'hidden'
          }}>
            <div 
              style={{ 
                background: '#f1f5f9', 
                padding: '16px', 
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none'
              }}
              onClick={() => toggleSection(sectionId)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: '600', 
                  color: '#1e293b' 
                }}>
                  {section.title}
                </span>
                <span style={{ 
                  background: '#3b82f6', 
                  color: 'white', 
                  padding: '4px 8px', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {totalSectionPoints} pts
                </span>
              </div>
              <span style={{ 
                fontSize: '20px', 
                color: '#64748b',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}>
                ▼
              </span>
            </div>

            {isExpanded && (
              <div style={{ padding: '16px' }}>
                {/* Section-level items */}
                {(section.rubricItems || []).length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '14px' }}>Section Items:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {section.rubricItems.map((item: any, itemIndex: number) => (
                        <div key={itemIndex} style={{ 
                          background: '#f8fafc', 
                          padding: '12px', 
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ 
                                margin: '0 0 8px 0', 
                                fontWeight: '500', 
                                color: '#1e293b' 
                              }}>
                                {item.title}
                              </p>
                              {item.feedback && (
                                <p style={{ 
                                  margin: 0, 
                                  fontSize: '12px', 
                                  color: '#64748b',
                                  fontStyle: 'italic'
                                }}>
                                  {item.feedback}
                                </p>
                              )}
                            </div>
                            <span style={{ 
                              background: '#10b981', 
                              color: 'white', 
                              padding: '4px 8px', 
                              borderRadius: '12px', 
                              fontSize: '12px',
                              fontWeight: '500',
                              whiteSpace: 'nowrap'
                            }}>
                              +{item.points} pts
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parts */}
                {(section.parts || []).map((part: any, partIndex: number) => {
                  const partId = `part-${sectionIndex}-${partIndex}`;
                  const isPartExpanded = expandedParts.has(partId);
                  const partPoints = (part.rubricItems || []).reduce((sum: number, item: any) => sum + (item.points || 0), 0);

                  return (
                    <div key={partId} style={{ 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '6px', 
                      marginBottom: '12px',
                      background: '#fafafa'
                    }}>
                      <div 
                        style={{ 
                          background: '#f3f4f6', 
                          padding: '12px', 
                          borderBottom: isPartExpanded ? '1px solid #e5e7eb' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onClick={() => togglePart(partId)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <span style={{ 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            color: '#374151' 
                          }}>
                            {part.title}
                          </span>
                          <span style={{ 
                            background: '#059669', 
                            color: 'white', 
                            padding: '2px 6px', 
                            borderRadius: '8px', 
                            fontSize: '10px',
                            fontWeight: '500'
                          }}>
                            {partPoints} pts
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: '16px', 
                          color: '#64748b',
                          transform: isPartExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s'
                        }}>
                          ▼
                        </span>
                      </div>

                      {isPartExpanded && (
                        <div style={{ padding: '12px' }}>
                          {part.rubricItems && part.rubricItems.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {part.rubricItems.map((item: any, itemIndex: number) => (
                                <div key={itemIndex} style={{ 
                                  background: '#f8fafc', 
                                  padding: '12px', 
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                      <p style={{ 
                                        margin: '0 0 8px 0', 
                                        fontWeight: '500', 
                                        color: '#1e293b' 
                                      }}>
                                        {item.title}
                                      </p>
                                      {item.feedback && (
                                        <p style={{ 
                                          margin: 0, 
                                          fontSize: '12px', 
                                          color: '#64748b',
                                          fontStyle: 'italic'
                                        }}>
                                          {item.feedback}
                                        </p>
                                      )}
                                    </div>
                                    <span style={{ 
                                      background: '#10b981', 
                                      color: 'white', 
                                      padding: '4px 8px', 
                                      borderRadius: '12px', 
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      +{item.points} pts
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>
                              No rubric items defined for this part.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Show message if no parts and no section items */}
                {(section.parts || []).length === 0 && (section.rubricItems || []).length === 0 && (
                  <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>
                    No rubric items defined for this section.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
} 