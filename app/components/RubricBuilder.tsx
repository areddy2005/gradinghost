'use client';

import React, { useState } from 'react';

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

interface RubricBuilderProps {
  initialRubric?: any;
  totalPoints: number;
  onSave: (rubric: any) => void;
  onCancel: () => void;
}

export default function RubricBuilder({ initialRubric, totalPoints, onSave, onCancel }: RubricBuilderProps) {
  const [sections, setSections] = useState<RubricSection[]>(() => {
    if (initialRubric?.sections) {
      return initialRubric.sections.map((section: any, index: number) => {
        // Convert old format (criteria) to new format (rubricItems)
        const oldCriteria = section.criteria || [];
        const newRubricItems = oldCriteria.map((criterion: any, itemIndex: number) => ({
          id: `item-${index}-${itemIndex}`,
          title: criterion.text || `Item ${itemIndex + 1}`,
          points: criterion.points || 0,
          feedback: criterion.comment || ''
        }));

        return {
          id: section.id || `section-${index}`,
          title: section.title || `Section ${index + 1}`,
          parts: section.parts?.map((part: any, partIndex: number) => ({
            id: part.id || `part-${index}-${partIndex}`,
            title: part.title || `Part ${partIndex + 1}`,
            rubricItems: part.rubricItems?.map((item: any, itemIndex: number) => ({
              id: item.id || `item-${index}-${partIndex}-${itemIndex}`,
              title: item.title || `Item ${itemIndex + 1}`,
              points: item.points || 0,
              feedback: item.feedback || ''
            })) || []
          })) || [],
          rubricItems: section.rubricItems || newRubricItems
        };
      });
    }
    return [{
      id: 'section-1',
      title: 'Question 1',
      parts: [],
      rubricItems: []
    }];
  });

  const addSection = () => {
    const newSection: RubricSection = {
      id: `section-${Date.now()}`,
      title: `Section ${sections.length + 1}`,
      parts: [],
      rubricItems: []
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (sectionId: string) => {
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const updateSection = (sectionId: string, updates: Partial<RubricSection>) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, ...updates } : s
    ));
  };

  const addPart = (sectionId: string) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        const newPart: RubricPart = {
          id: `part-${Date.now()}`,
          title: 'New Part',
          rubricItems: []
        };
        return { 
          ...section, 
          parts: [...(section.parts || []), newPart] 
        };
      }
      return section;
    }));
  };

  const removePart = (sectionId: string, partId: string) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        return { 
          ...section, 
          parts: (section.parts || []).filter(part => part.id !== partId) 
        };
      }
      return section;
    }));
  };

  const updatePart = (sectionId: string, partId: string, updates: Partial<RubricPart>) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          parts: (section.parts || []).map(part => 
            part.id === partId ? { ...part, ...updates } : part
          )
        };
      }
      return section;
    }));
  };

  const addItem = (sectionId: string, partId?: string) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        const newItem: RubricItem = {
          id: `item-${Date.now()}`,
          title: 'New rubric item',
          points: 0,
          feedback: ''
        };

        if (partId) {
          // Add to specific part
          return {
            ...section,
            parts: (section.parts || []).map(part => 
              part.id === partId 
                ? { ...part, rubricItems: [...part.rubricItems, newItem] }
                : part
            )
          };
        } else {
          // Add to section directly
          return { 
            ...section, 
            rubricItems: [...(section.rubricItems || []), newItem] 
          };
        }
      }
      return section;
    }));
  };

  const removeItem = (sectionId: string, itemId: string, partId?: string) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        if (partId) {
          // Remove from specific part
          return {
            ...section,
            parts: (section.parts || []).map(part => 
              part.id === partId 
                ? { ...part, rubricItems: part.rubricItems.filter(item => item.id !== itemId) }
                : part
            )
          };
        } else {
          // Remove from section directly
          return { 
            ...section, 
            rubricItems: (section.rubricItems || []).filter(item => item.id !== itemId) 
          };
        }
      }
      return section;
    }));
  };

  const updateItem = (sectionId: string, itemId: string, updates: Partial<RubricItem>, partId?: string) => {
    setSections(sections.map(section => {
      if (section.id === sectionId) {
        if (partId) {
          // Update in specific part
          return {
            ...section,
            parts: (section.parts || []).map(part => 
              part.id === partId 
                ? { 
                    ...part, 
                    rubricItems: part.rubricItems.map(item => 
                      item.id === itemId ? { ...item, ...updates } : item
                    )
                  }
                : part
            )
          };
        } else {
          // Update in section directly
          return {
            ...section,
            rubricItems: (section.rubricItems || []).map(item => 
              item.id === itemId ? { ...item, ...updates } : item
            )
          };
        }
      }
      return section;
    }));
  };

  const calculateTotalPoints = () => {
    return sections.reduce((total, section) => {
      let sectionTotal = 0;
      
      // Add points from section-level items
      sectionTotal += (section.rubricItems || []).reduce((sum, item) => sum + item.points, 0);
      
      // Add points from part-level items
      sectionTotal += (section.parts || []).reduce((partSum, part) => {
        return partSum + part.rubricItems.reduce((itemSum, item) => itemSum + item.points, 0);
      }, 0);
      
      return total + sectionTotal;
    }, 0);
  };

  const handleSave = () => {
    const rubric = {
      sections: sections.map(section => ({
        id: section.id,
        title: section.title,
        parts: section.parts?.map(part => ({
          id: part.id,
          title: part.title,
          rubricItems: part.rubricItems.map(item => ({
            id: item.id,
            title: item.title,
            points: item.points,
            feedback: item.feedback
          }))
        })),
        rubricItems: section.rubricItems?.map(item => ({
          id: item.id,
          title: item.title,
          points: item.points,
          feedback: item.feedback
        }))
      }))
    };
    onSave(rubric);
  };

  const totalAssignedPoints = calculateTotalPoints();
  const isValid = totalAssignedPoints === totalPoints;

  return (
    <div className="rubric-builder" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Rubric Builder</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={addSection}
            style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Add Section
          </button>
          <button 
            onClick={handleSave}
            disabled={!isValid}
            style={{ 
              padding: '8px 16px', 
              background: isValid ? '#059669' : '#6b7280', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: isValid ? 'pointer' : 'not-allowed' 
            }}
          >
            Save Rubric
          </button>
          <button 
            onClick={onCancel}
            style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', background: isValid ? '#d1fae5' : '#fef3c7', borderRadius: '4px' }}>
        <strong>Points Summary:</strong> {totalAssignedPoints} / {totalPoints} points assigned
        {!isValid && <span style={{ color: '#dc2626', marginLeft: '10px' }}>
          ⚠️ Points must equal {totalPoints}
        </span>}
      </div>

      {sections.map((section, sectionIndex) => (
        <div key={section.id} style={{ border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ background: '#f9fafb', padding: '16px', borderBottom: '1px solid #d1d5db' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => updateSection(section.id, { title: e.target.value })}
                  style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '4px', 
                    padding: '4px 8px',
                    flex: 1
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => addPart(section.id)}
                  style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Add Part
                </button>
                <button 
                  onClick={() => addItem(section.id)}
                  style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Add Item
                </button>
                {sections.length > 1 && (
                  <button 
                    onClick={() => removeSection(section.id)}
                    style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {/* Section-level items */}
            {(section.rubricItems || []).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>Section Items:</h4>
                {(section.rubricItems || []).map((item, itemIndex) => (
                  <RubricItemComponent
                    key={item.id}
                    item={item}
                    onUpdate={(updates) => updateItem(section.id, item.id, updates)}
                    onRemove={() => removeItem(section.id, item.id)}
                  />
                ))}
              </div>
            )}

            {/* Parts */}
            {(section.parts || []).map((part, partIndex) => (
              <div key={part.id} style={{ 
                border: '1px solid #e5e7eb', 
                borderRadius: '6px', 
                marginBottom: '12px',
                background: '#fafafa'
              }}>
                <div style={{ 
                  background: '#f3f4f6', 
                  padding: '12px', 
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <input
                      type="text"
                      value={part.title}
                      onChange={(e) => updatePart(section.id, part.id, { title: e.target.value })}
                      style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '4px', 
                        padding: '4px 8px',
                        flex: 1
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => addItem(section.id, part.id)}
                      style={{ padding: '4px 8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Add Item
                    </button>
                    <button 
                      onClick={() => removePart(section.id, part.id)}
                      style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div style={{ padding: '12px' }}>
                  {part.rubricItems.length === 0 ? (
                    <p style={{ color: '#6b7280', fontStyle: 'italic', margin: 0 }}>
                      No rubric items yet. Click "Add Item" to get started.
                    </p>
                  ) : (
                    part.rubricItems.map((item, itemIndex) => (
                      <RubricItemComponent
                        key={item.id}
                        item={item}
                        onUpdate={(updates) => updateItem(section.id, item.id, updates, part.id)}
                        onRemove={() => removeItem(section.id, item.id, part.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}

            {/* Show message if no parts and no section items */}
            {(section.parts || []).length === 0 && (section.rubricItems || []).length === 0 && (
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                No rubric items yet. Click "Add Item" or "Add Part" to get started.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface RubricItemComponentProps {
  item: RubricItem;
  onUpdate: (updates: Partial<RubricItem>) => void;
  onRemove: () => void;
}

function RubricItemComponent({ item, onUpdate, onRemove }: RubricItemComponentProps) {
  return (
    <div style={{ 
      border: '1px solid #e5e7eb', 
      borderRadius: '4px', 
      padding: '12px', 
      marginBottom: '8px',
      background: '#fafafa'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={item.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Rubric item title"
            style={{ 
              width: '100%', 
              border: '1px solid #d1d5db', 
              borderRadius: '4px', 
              padding: '6px 8px',
              marginBottom: '8px'
            }}
          />
          <textarea
            value={item.feedback}
            onChange={(e) => onUpdate({ feedback: e.target.value })}
            placeholder="Feedback for TA use (optional)"
            rows={2}
            style={{ 
              width: '100%', 
              border: '1px solid #d1d5db', 
              borderRadius: '4px', 
              padding: '6px 8px',
              fontSize: '12px',
              color: '#6b7280'
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="number"
            min="0"
            value={item.points}
            onChange={(e) => onUpdate({ points: parseInt(e.target.value) || 0 })}
            style={{ 
              width: '60px', 
              border: '1px solid #d1d5db', 
              borderRadius: '4px', 
              padding: '4px 8px' 
            }}
          />
          <span style={{ fontSize: '12px' }}>pts</span>
          <button 
            onClick={onRemove}
            style={{ 
              padding: '4px 6px', 
              background: '#dc2626', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              fontSize: '10px' 
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
} 