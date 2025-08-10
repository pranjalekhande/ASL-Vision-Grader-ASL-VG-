import React, { useState, useRef, useCallback } from 'react';

interface FeedbackItem {
  id: string;
  timestamp: number;
  category: 'shape' | 'location' | 'movement' | 'general';
  severity: 'low' | 'medium' | 'high';
  content: string;
  created_at: string;
  teacher_id: string;
  area_coordinates?: { x: number; y: number; width: number; height: number };
}

interface TimestampedFeedbackProps {
  attemptId: string;
  videoDuration: number;
  currentTime: number;
  feedbackItems: FeedbackItem[];
  onAddFeedback: (feedback: Omit<FeedbackItem, 'id' | 'created_at' | 'teacher_id'>) => Promise<void>;
  onUpdateFeedback: (id: string, updates: Partial<FeedbackItem>) => Promise<void>;
  onDeleteFeedback: (id: string) => Promise<void>;
  onSeekToTimestamp: (timestamp: number) => void;
  readOnly?: boolean;
}

export const TimestampedFeedback: React.FC<TimestampedFeedbackProps> = ({
  attemptId,
  videoDuration,
  currentTime,
  feedbackItems,
  onAddFeedback,
  onUpdateFeedback,
  onDeleteFeedback,
  onSeekToTimestamp,
  readOnly = false
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFeedback, setNewFeedback] = useState({
    timestamp: currentTime,
    category: 'general' as const,
    severity: 'medium' as const,
    content: '',
    area_coordinates: undefined as { x: number; y: number; width: number; height: number } | undefined
  });

  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Format timestamp for display
  const formatTimestamp = useCallback((timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    const milliseconds = Math.floor((timestamp % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }, []);

  // Add new feedback
  const handleAddFeedback = useCallback(async () => {
    if (!newFeedback.content.trim()) return;

    try {
      await onAddFeedback(newFeedback);
      setNewFeedback({
        timestamp: currentTime,
        category: 'general',
        severity: 'medium',
        content: '',
        area_coordinates: undefined
      });
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to add feedback:', error);
    }
  }, [newFeedback, onAddFeedback, currentTime]);

  // Update existing feedback
  const handleUpdateFeedback = useCallback(async (id: string, updates: Partial<FeedbackItem>) => {
    try {
      await onUpdateFeedback(id, updates);
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update feedback:', error);
    }
  }, [onUpdateFeedback]);

  // Delete feedback
  const handleDeleteFeedback = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;
    
    try {
      await onDeleteFeedback(id);
    } catch (error) {
      console.error('Failed to delete feedback:', error);
    }
  }, [onDeleteFeedback]);

  // Start adding feedback at current time
  const startAddingFeedback = useCallback(() => {
    setNewFeedback(prev => ({
      ...prev,
      timestamp: currentTime
    }));
    setIsAdding(true);
    setTimeout(() => contentRef.current?.focus(), 100);
  }, [currentTime]);

  // Get category color
  const getCategoryColor = useCallback((category: string) => {
    switch (category) {
      case 'shape': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'location': return 'bg-green-100 text-green-800 border-green-200';
      case 'movement': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, []);

  // Get severity color
  const getSeverityColor = useCallback((severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  }, []);

  // Sort feedback by timestamp
  const sortedFeedback = [...feedbackItems].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Timestamped Feedback</h3>
        {!readOnly && (
          <button
            onClick={startAddingFeedback}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add Feedback
          </button>
        )}
      </div>

      {/* Add new feedback form */}
      {isAdding && !readOnly && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="space-y-4">
            {/* Timestamp and category row */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timestamp
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={videoDuration}
                  value={newFeedback.timestamp}
                  onChange={(e) => setNewFeedback(prev => ({
                    ...prev,
                    timestamp: Number(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {formatTimestamp(newFeedback.timestamp)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={newFeedback.category}
                  onChange={(e) => setNewFeedback(prev => ({
                    ...prev,
                    category: e.target.value as any
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">General</option>
                  <option value="shape">Hand Shape</option>
                  <option value="location">Location</option>
                  <option value="movement">Movement</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={newFeedback.severity}
                  onChange={(e) => setNewFeedback(prev => ({
                    ...prev,
                    severity: e.target.value as any
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feedback Content
              </label>
              <textarea
                ref={contentRef}
                value={newFeedback.content}
                onChange={(e) => setNewFeedback(prev => ({
                  ...prev,
                  content: e.target.value
                }))}
                placeholder="Provide specific feedback for this moment in the video..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFeedback}
                disabled={!newFeedback.content.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing feedback items */}
      <div className="space-y-3">
        {sortedFeedback.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No feedback added yet</p>
            {!readOnly && (
              <p className="text-sm mt-1">Click "Add Feedback" to provide timestamped comments</p>
            )}
          </div>
        ) : (
          sortedFeedback.map((feedback) => (
            <div
              key={feedback.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              {editingId === feedback.id ? (
                <EditFeedbackForm
                  feedback={feedback}
                  videoDuration={videoDuration}
                  onSave={(updates) => handleUpdateFeedback(feedback.id, updates)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onSeekToTimestamp(feedback.timestamp)}
                        className="text-blue-600 hover:text-blue-800 font-mono text-sm font-medium"
                        title="Jump to this timestamp"
                      >
                        {formatTimestamp(feedback.timestamp)}
                      </button>
                      <span className={`px-2 py-1 text-xs rounded-full border ${getCategoryColor(feedback.category)}`}>
                        {feedback.category}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full border ${getSeverityColor(feedback.severity)}`}>
                        {feedback.severity} priority
                      </span>
                    </div>

                    {!readOnly && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingId(feedback.id)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteFeedback(feedback.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="text-gray-800">
                    {feedback.content}
                  </div>

                  {/* Meta info */}
                  <div className="text-xs text-gray-500">
                    Added {new Date(feedback.created_at).toLocaleDateString()} at{' '}
                    {new Date(feedback.created_at).toLocaleTimeString()}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quick navigation */}
      {sortedFeedback.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Quick Navigation</h4>
          <div className="flex flex-wrap gap-2">
            {sortedFeedback.map((feedback) => (
              <button
                key={feedback.id}
                onClick={() => onSeekToTimestamp(feedback.timestamp)}
                className={`px-2 py-1 text-xs rounded border hover:bg-white transition-colors ${getCategoryColor(feedback.category)}`}
              >
                {formatTimestamp(feedback.timestamp)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Edit feedback form component
interface EditFeedbackFormProps {
  feedback: FeedbackItem;
  videoDuration: number;
  onSave: (updates: Partial<FeedbackItem>) => void;
  onCancel: () => void;
}

const EditFeedbackForm: React.FC<EditFeedbackFormProps> = ({
  feedback,
  videoDuration,
  onSave,
  onCancel
}) => {
  const [editData, setEditData] = useState({
    timestamp: feedback.timestamp,
    category: feedback.category,
    severity: feedback.severity,
    content: feedback.content
  });

  const handleSave = () => {
    onSave(editData);
  };

  const formatTimestamp = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    const milliseconds = Math.floor((timestamp % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Timestamp and category row */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timestamp
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max={videoDuration}
            value={editData.timestamp}
            onChange={(e) => setEditData(prev => ({
              ...prev,
              timestamp: Number(e.target.value)
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="text-xs text-gray-500 mt-1">
            {formatTimestamp(editData.timestamp)}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={editData.category}
            onChange={(e) => setEditData(prev => ({
              ...prev,
              category: e.target.value as any
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="general">General</option>
            <option value="shape">Hand Shape</option>
            <option value="location">Location</option>
            <option value="movement">Movement</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            value={editData.severity}
            onChange={(e) => setEditData(prev => ({
              ...prev,
              severity: e.target.value as any
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Feedback Content
        </label>
        <textarea
          value={editData.content}
          onChange={(e) => setEditData(prev => ({
            ...prev,
            content: e.target.value
          }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!editData.content.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};
