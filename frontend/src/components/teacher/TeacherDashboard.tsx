import React, { useState, useEffect, useRef } from 'react';
import { useAuth2FA } from '../../hooks/useAuth2FA';
import { supabase } from '../../config/supabase';
import { ReferenceRecorder } from '../signs/ReferenceRecorder';
import { VideoReviewPlayer } from './VideoReviewPlayer';
import { TimestampedFeedback } from './TimestampedFeedback';
import { VideoThumbnailDashboard } from './VideoThumbnailDashboard';
import { VideoRecorder } from '../video/VideoRecorder';
import { FeedbackService, type FeedbackItem } from '../../services/feedbackService';
import { 
  calculateOverallScore, 
  getScoreStatistics,
  categorizeScore,
  formatScore
} from '../../utils/scoreCalculation';
import type { HandLandmarkFrame } from '../../types/landmarks';

type DashboardView = 'overview' | 'exemplars' | 'students' | 'video-review';

// Simple inline landmark viewer component for exemplar preview
const ExemplarLandmarkViewer: React.FC<{ landmarks: HandLandmarkFrame[] }> = ({ landmarks }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Draw landmarks on canvas
  const drawLandmarks = (frame: HandLandmarkFrame) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each hand
    frame.landmarks.forEach((handLandmarks, handIndex) => {
      const color = handIndex === 0 ? '#00ff00' : '#ff0000'; // Green for first hand, red for second
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Draw landmarks as points
      handLandmarks.forEach((landmark, index) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw landmark index for debugging (optional)
        if (index % 4 === 0) { // Show every 4th landmark number to avoid clutter
          ctx.fillStyle = 'white';
          ctx.font = '10px Arial';
          ctx.fillText(index.toString(), x + 5, y - 5);
          ctx.fillStyle = color;
        }
      });

      // Draw basic hand connections (simplified)
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [0, 9], [9, 10], [10, 11], [11, 12], // Middle
        [0, 13], [13, 14], [14, 15], [15, 16], // Ring
        [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      ];

      connections.forEach(([start, end]) => {
        if (start < handLandmarks.length && end < handLandmarks.length) {
          const startPoint = handLandmarks[start];
          const endPoint = handLandmarks[end];
          
          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }
      });
    });
  };

  // Animation effect
  useEffect(() => {
    let animationFrame: number;
    
    const animate = () => {
      if (isPlaying && landmarks.length > 0) {
        setCurrentFrame(prev => (prev + 1) % landmarks.length);
        animationFrame = requestAnimationFrame(() => setTimeout(animate, 100)); // ~10 FPS
      }
    };

    if (isPlaying) {
      animate();
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, landmarks.length]);

  // Draw current frame
  useEffect(() => {
    if (landmarks[currentFrame]) {
      drawLandmarks(landmarks[currentFrame]);
    }
  }, [currentFrame, landmarks]);

  return (
    <div className="bg-black rounded-lg p-4">
      <div className="text-center text-white mb-4">
        <h4 className="text-lg font-medium">Landmark Visualization</h4>
        <p className="text-sm text-gray-300">
          {landmarks.length} frames of landmark data
        </p>
      </div>

      {/* Canvas for landmark visualization */}
      <div className="flex justify-center mb-4">
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="border border-gray-600 rounded bg-black"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4 text-white">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        <span className="text-sm">
          Frame: {currentFrame + 1} / {landmarks.length}
        </span>
        
        <input
          type="range"
          min={0}
          max={landmarks.length - 1}
          value={currentFrame}
          onChange={(e) => setCurrentFrame(parseInt(e.target.value))}
          className="w-32"
        />
      </div>
    </div>
  );
};

// Exemplar edit form component
const ExemplarEditForm: React.FC<{
  exemplar: SignData;
  onSave: (updatedExemplar: SignData) => void;
  onCancel: () => void;
  isUpdating: boolean;
}> = ({ exemplar, onSave, onCancel, isUpdating }) => {
  const [formData, setFormData] = useState({
    name: exemplar.name || '',
    description: exemplar.description || '',
    difficulty: exemplar.difficulty || 'beginner',
    category: exemplar.category || 'basic',
    tags: exemplar.tags || []
  });
  const [newTag, setNewTag] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...exemplar, ...formData });
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((tag: string) => tag !== tagToRemove)
    }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onCancel}
        ></div>

        {/* Modal content */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Edit Exemplar: {exemplar.name}
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe this sign..."
              />
            </div>

            {/* Difficulty & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="basic">Basic</option>
                  <option value="emotions">Emotions</option>
                  <option value="actions">Actions</option>
                  <option value="objects">Objects</option>
                  <option value="people">People</option>
                  <option value="places">Places</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onCancel}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating || !formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Exemplar re-record component
const ExemplarRerecorder: React.FC<{
  originalExemplar: SignData;
  newRecordingData: {blob: Blob | null; landmarks: HandLandmarkFrame[]};
  onNewRecording: (blob: Blob, landmarks: HandLandmarkFrame[]) => void;
  onReplace: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}> = ({ originalExemplar, newRecordingData, onNewRecording, onReplace, onCancel, isUpdating }) => {
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onCancel}
        ></div>

        {/* Modal content */}
        <div className="inline-block w-full max-w-7xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Re-record Exemplar: {originalExemplar.name}
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Current Exemplar */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                <h4 className="text-lg font-medium text-gray-900 mb-2">Current Exemplar</h4>
                <div className="text-sm text-gray-600 mb-4">
                  <p>Frames: {originalExemplar.landmarks?.frames?.length || 0}</p>
                  <p>Last updated: {new Date(originalExemplar.updated_at).toLocaleDateString()}</p>
                </div>
                
                {originalExemplar.landmarks?.frames?.length > 0 ? (
                  <ExemplarLandmarkViewer landmarks={originalExemplar.landmarks.frames} />
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 text-center text-sm">
                      No landmark data available
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* New Recording */}
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                <h4 className="text-lg font-medium text-blue-900 mb-2">New Recording</h4>
                
                {!newRecordingData.blob ? (
                  <div className="space-y-4">
                    <p className="text-sm text-blue-700 mb-4">
                      Record a new version of this exemplar. The recording will replace the current one.
                    </p>
                    <VideoRecorder
                      onRecordingComplete={onNewRecording}
                      maxDuration={7}
                      width={640}
                      height={480}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-blue-700 mb-4">
                      <p>✅ New recording captured!</p>
                      <p>Frames: {newRecordingData.landmarks.length}</p>
                    </div>
                    
                    {newRecordingData.landmarks.length > 0 && (
                      <ExemplarLandmarkViewer landmarks={newRecordingData.landmarks} />
                    )}
                    
                    <button
                      onClick={() => onNewRecording(null as any, [])}
                      className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200"
                    >
                      Record Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comparison Stats */}
          {newRecordingData.blob && newRecordingData.landmarks.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-900 mb-2">Comparison</h5>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Original frames:</span>
                  <span className="ml-2 font-medium">{originalExemplar.landmarks?.frames?.length || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">New frames:</span>
                  <span className="ml-2 font-medium">{newRecordingData.landmarks.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Difference:</span>
                  <span className={`ml-2 font-medium ${
                    newRecordingData.landmarks.length > (originalExemplar.landmarks?.frames?.length || 0) 
                      ? 'text-green-600' 
                      : newRecordingData.landmarks.length < (originalExemplar.landmarks?.frames?.length || 0)
                      ? 'text-red-600' 
                      : 'text-gray-600'
                  }`}>
                    {newRecordingData.landmarks.length - (originalExemplar.landmarks?.frames?.length || 0)} frames
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <button
              onClick={onCancel}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onReplace}
              disabled={isUpdating || !newRecordingData.blob || newRecordingData.landmarks.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? 'Replacing...' : 'Replace Exemplar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SignData {
  id: string;
  name: string;
  landmarks: any;
  created_at: string;
  updated_at: string;
  description?: string;
  difficulty?: string;
  category?: string;
  tags?: string[];
}

interface StudentData {
  id: string;
  full_name: string;
  institution?: string;
  created_at: string;
  total_attempts: number;
  signs_practiced: number;
  avg_score: number;
  high_score_count?: number;
  best_score?: number;
  improvement_trend?: number;
  recent_attempts?: StudentAttempt[];
}

interface StudentAttempt {
  id: string;
  sign_id: string;
  sign_name: string;
  score_shape: number | null;
  score_location: number | null;
  score_movement: number | null;
  created_at: string;
  video_url: string | null;
  student_id?: string;
  student_name?: string;
  landmarks?: any;
  feedback_count?: number;
}

export function TeacherDashboard() {
  const { profile, signOut } = useAuth2FA();
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [signs, setSigns] = useState<SignData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [showStudentDetail, setShowStudentDetail] = useState(false);
  
  // Video review state
  const [recentAttempts, setRecentAttempts] = useState<StudentAttempt[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<StudentAttempt | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  
  // Student-specific video review state
  const [studentAttempts, setStudentAttempts] = useState<StudentAttempt[]>([]);
  const [selectedStudentAttempt, setSelectedStudentAttempt] = useState<StudentAttempt | null>(null);
  
  // Feedback state
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  
  // Exemplar management state
  const [previewExemplar, setPreviewExemplar] = useState<SignData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editExemplar, setEditExemplar] = useState<SignData | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [rerecordExemplar, setRerecordExemplar] = useState<SignData | null>(null);
  const [showRerecord, setShowRerecord] = useState(false);
  const [newRecordingData, setNewRecordingData] = useState<{blob: Blob | null; landmarks: HandLandmarkFrame[]}>({blob: null, landmarks: []});

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Handler for exemplar preview
  const handlePreviewExemplar = (sign: SignData) => {
    setPreviewExemplar(sign);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewExemplar(null);
  };

  // Handler for exemplar editing
  const handleEditExemplar = (sign: SignData) => {
    setEditExemplar({ ...sign }); // Create a copy for editing
    setShowEdit(true);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditExemplar(null);
  };

  const handleSaveEdit = async (updatedExemplar: SignData) => {
    if (!updatedExemplar || isUpdating) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('signs')
        .update({
          name: updatedExemplar.name,
          description: updatedExemplar.description,
          difficulty: updatedExemplar.difficulty,
          category: updatedExemplar.category,
          tags: updatedExemplar.tags,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedExemplar.id);

      if (error) {
        throw error;
      }

      // Update the local signs array
      setSigns(prevSigns => 
        prevSigns.map(sign => 
          sign.id === updatedExemplar.id 
            ? { ...sign, ...updatedExemplar, updated_at: new Date().toISOString() }
            : sign
        )
      );

      closeEdit();
      alert('Exemplar updated successfully!');
    } catch (error) {
      console.error('Error updating exemplar:', error);
      alert('Failed to update exemplar. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handler for exemplar re-recording
  const handleRerecordExemplar = (sign: SignData) => {
    setRerecordExemplar(sign);
    setShowRerecord(true);
    setNewRecordingData({blob: null, landmarks: []});
  };

  const closeRerecord = () => {
    setShowRerecord(false);
    setRerecordExemplar(null);
    setNewRecordingData({blob: null, landmarks: []});
  };

  const handleNewRecording = (blob: Blob, landmarks: HandLandmarkFrame[]) => {
    setNewRecordingData({blob, landmarks});
  };

  const handleReplaceExemplar = async () => {
    if (!rerecordExemplar || !newRecordingData.blob || !newRecordingData.landmarks.length || isUpdating) {
      return;
    }

    setIsUpdating(true);
    try {
      // Create the new landmark data structure
      const newLandmarkData = {
        frames: newRecordingData.landmarks,
        startTime: 0,
        endTime: newRecordingData.landmarks.length * 33, // Assume ~30fps
        duration: newRecordingData.landmarks.length * 33
      };

      // Update the exemplar in the database
      const { error } = await supabase
        .from('signs')
        .update({
          landmarks: newLandmarkData,
          updated_at: new Date().toISOString()
        })
        .eq('id', rerecordExemplar.id);

      if (error) {
        throw error;
      }

      // Update the local signs array
      setSigns(prevSigns => 
        prevSigns.map(sign => 
          sign.id === rerecordExemplar.id 
            ? { ...sign, landmarks: newLandmarkData, updated_at: new Date().toISOString() }
            : sign
        )
      );

      closeRerecord();
      alert('Exemplar re-recorded successfully!');
    } catch (error) {
      console.error('Error replacing exemplar:', error);
      alert('Failed to replace exemplar. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };



  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Debug: Check current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Current user:', user);
      console.log('User error:', userError);

      // Load signs
      const { data: signsData } = await supabase
        .from('signs')
        .select('*')
        .order('name');
      
      if (signsData) setSigns(signsData);

      // Debug: Check all profiles to see what roles exist
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at');
      
      console.log('All profiles in database:', allProfiles);
      console.log('All profiles error:', allProfilesError);

      // Try different approaches to load student data
      console.log('Trying to load students...');
      
      // First try: Standard query
      const { data: studentsData, error: studentsError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          created_at,
          role
        `)
        .eq('role', 'student')
        .order('full_name');
      
      console.log('Raw students data from query:', studentsData);
      console.log('Students query error:', studentsError);

      // If primary query failed, use alternative approach
      let finalStudentsData = studentsData;
      if (!studentsData && !studentsError) {
        console.log('Using fallback approach - loading all profiles and filtering...');
        const { data: allUsers } = await supabase
          .from('profiles')
          .select('*');
        
        // Filter students client-side and format for our interface
        finalStudentsData = allUsers?.filter(user => user.role === 'student') || [];
        console.log('Fallback students found:', finalStudentsData);
      }
      
      if (finalStudentsData && finalStudentsData.length > 0) {
        // Get real attempt statistics for each student
        const studentsWithStats = await Promise.all(
          finalStudentsData.map(async (student) => {
            // Get ALL student's attempts for accurate statistics
            const { data: allAttempts } = await supabase
              .from('attempts')
              .select(`
                id,
                sign_id,
                score_shape,
                score_location,
                score_movement,
                created_at,
                video_url
              `)
              .eq('student_id', student.id)
              .order('created_at', { ascending: false });

            // Get recent 5 attempts with sign names for preview
            const { data: recentAttemptsData } = await supabase
              .from('attempts')
              .select(`
                id,
                sign_id,
                score_shape,
                score_location,
                score_movement,
                created_at,
                video_url,
                signs (
                  name
                )
              `)
              .eq('student_id', student.id)
              .order('created_at', { ascending: false })
              .limit(5);

            const total_attempts = allAttempts?.length || 0;
            
            // Calculate unique signs practiced
            const uniqueSignIds = new Set(allAttempts?.map(attempt => attempt.sign_id) || []);
            const signs_practiced = uniqueSignIds.size;
            
            // Calculate comprehensive statistics using utility functions
            const statistics = getScoreStatistics(allAttempts || []);

            // Format recent attempts
            const recent_attempts: StudentAttempt[] = recentAttemptsData?.map(attempt => ({
              id: attempt.id,
              sign_id: attempt.sign_id,
              sign_name: (attempt.signs as any)?.name || 'Unknown Sign',
              score_shape: attempt.score_shape,
              score_location: attempt.score_location,
              score_movement: attempt.score_movement,
              created_at: attempt.created_at,
              video_url: attempt.video_url
            })) || [];

            return {
              ...student,
              total_attempts,
              signs_practiced,
              avg_score: statistics.averageScore,
              high_score_count: statistics.highScoreCount,
              best_score: statistics.bestScore,
              improvement_trend: statistics.improvementTrend,
              recent_attempts
            };
          })
        );
        
        console.log('Students with stats calculated:', studentsWithStats);
        setStudents(studentsWithStats);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecorderComplete = () => {
    setShowRecorder(false);
    // Reload signs to show the new exemplar
    loadDashboardData();
  };

  const handleStudentClick = (student: StudentData) => {
    setSelectedStudent(student);
    setShowStudentDetail(true);
    setSelectedStudentAttempt(null); // Reset video review selection
    // Load student attempts for video review
    loadStudentAttempts(student.id);
  };




  // Load recent attempts for video review
  const loadRecentAttempts = async () => {
    try {
      const { data: attempts, error } = await supabase
        .from('attempts')
        .select(`
          id,
          student_id,
          sign_id,
          score_shape,
          score_location,
          score_movement,
          created_at,
          video_url,
          landmarks
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (attempts) {
        // Fetch student and sign names separately
        const attemptsWithDetails = await Promise.all(
          attempts.map(async (attempt) => {
            // Get student name
            const { data: studentData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', attempt.student_id)
              .single();

            // Get sign name
            const { data: signData } = await supabase
              .from('signs')
              .select('name')
              .eq('id', attempt.sign_id)
              .single();

            // Get feedback count (if feedback table exists)
            let feedbackCount = 0;
            try {
              const { data: feedbackData } = await supabase
                .from('feedback')
                .select('id')
                .eq('attempt_id', attempt.id);
              feedbackCount = feedbackData?.length || 0;
            } catch (feedbackError) {
              // Feedback table might not exist yet
              console.log('Feedback table not available:', feedbackError);
            }

            return {
              ...attempt,
              student_name: studentData?.full_name || 'Unknown Student',
              sign_name: signData?.name || 'Unknown Sign',
              feedback_count: feedbackCount
            };
          })
        );

        // Log video URL status for debugging
        const urlStats = attemptsWithDetails.reduce((stats, attempt) => {
          if (!attempt.video_url) {
            stats.null++;
          } else if (attempt.video_url.trim() === '') {
            stats.empty++;
          } else {
            try {
              new URL(attempt.video_url);
              stats.valid++;
            } catch {
              stats.invalid++;
              console.warn('Invalid video URL detected:', attempt.id, attempt.video_url);
            }
          }
          return stats;
        }, { null: 0, empty: 0, valid: 0, invalid: 0 });

        console.log('Video URL statistics:', urlStats);
        setRecentAttempts(attemptsWithDetails);
      }
    } catch (error) {
      console.error('Error loading recent attempts:', error);
    }
  };

  // Load recent attempts when video-review tab is selected
  useEffect(() => {
    if (currentView === 'video-review') {
      loadRecentAttempts();
    }
  }, [currentView]);

  // Load feedback when an attempt is selected
  useEffect(() => {
    if (selectedStudentAttempt) {
      loadFeedbackForAttempt(selectedStudentAttempt.id);
    }
  }, [selectedStudentAttempt]);

  // Load specific student attempts for video review
  const loadStudentAttempts = async (studentId: string) => {
    try {
      const { data: attempts, error } = await supabase
        .from('attempts')
        .select(`
          id,
          student_id,
          sign_id,
          score_shape,
          score_location,
          score_movement,
          created_at,
          video_url,
          landmarks
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50); // Get more attempts for individual student

      if (error) throw error;

      if (attempts) {
        // Fetch sign names for each attempt
        const attemptsWithDetails = await Promise.all(
          attempts.map(async (attempt) => {
            // Get sign name
            const { data: signData } = await supabase
              .from('signs')
              .select('name')
              .eq('id', attempt.sign_id)
              .single();

            // Get feedback count (if feedback table exists)
            let feedbackCount = 0;
            try {
              const { data: feedbackData } = await supabase
                .from('feedback')
                .select('id')
                .eq('attempt_id', attempt.id);
              feedbackCount = feedbackData?.length || 0;
            } catch (feedbackError) {
              // Feedback table might not exist yet
            }

            return {
              ...attempt,
              student_name: selectedStudent?.full_name || 'Unknown Student',
              sign_name: signData?.name || 'Unknown Sign',
              feedback_count: feedbackCount
            };
          })
        );

        setStudentAttempts(attemptsWithDetails);
      }
    } catch (error) {
      console.error('Error loading student attempts:', error);
    }
  };

  // Feedback functions
  const loadFeedbackForAttempt = async (attemptId: string) => {
    setLoadingFeedback(true);
    try {
      const feedback = await FeedbackService.getFeedbackForAttempt(attemptId);
      setFeedbackItems(feedback);
    } catch (error) {
      console.error('Error loading feedback:', error);
      // If feedback table doesn't exist, show helpful message
      if (error instanceof Error && error.message.includes('does not exist')) {
        alert('Feedback system is not yet set up. Please run the database migrations first.');
      }
      setFeedbackItems([]);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const handleAddFeedback = async (feedbackData: any) => {
    if (!selectedStudentAttempt) return;

    try {
      await FeedbackService.addFeedback({
        attempt_id: selectedStudentAttempt.id,
        ...feedbackData
      });
      
      // Reload feedback
      await loadFeedbackForAttempt(selectedStudentAttempt.id);
      
      // Update feedback count in studentAttempts
      setStudentAttempts(prev => prev.map(attempt => 
        attempt.id === selectedStudentAttempt.id 
          ? { ...attempt, feedback_count: (attempt.feedback_count || 0) + 1 }
          : attempt
      ));
    } catch (error) {
      console.error('Error adding feedback:', error);
      alert('Failed to add feedback. Please check database setup.');
    }
  };

  const handleUpdateFeedback = async (feedbackId: string, updates: any) => {
    try {
      await FeedbackService.updateFeedback(feedbackId, updates);
      await loadFeedbackForAttempt(selectedStudentAttempt!.id);
    } catch (error) {
      console.error('Error updating feedback:', error);
      alert('Failed to update feedback.');
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    try {
      await FeedbackService.deleteFeedback(feedbackId);
      await loadFeedbackForAttempt(selectedStudentAttempt!.id);
      
      // Update feedback count
      setStudentAttempts(prev => prev.map(attempt => 
        attempt.id === selectedStudentAttempt!.id 
          ? { ...attempt, feedback_count: Math.max(0, (attempt.feedback_count || 0) - 1) }
          : attempt
      ));
    } catch (error) {
      console.error('Error deleting feedback:', error);
      alert('Failed to delete feedback.');
    }
  };

  const NavButton = ({ view, children }: { view: DashboardView; children: React.ReactNode }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        currentView === view
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - App title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">ASL</span>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">Vision Grader</h1>
              </div>
              <span className="text-gray-400">|</span>
              <span className="text-lg font-medium text-gray-700">Teacher Dashboard</span>
            </div>
            
            {/* Right side - User info and actions */}
            <div className="flex items-center space-x-4">
              {/* User info */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                  <p className="text-xs text-gray-500">Teacher Account</p>
                </div>
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-sm">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'T'}
                  </span>
                </div>
              </div>
              
              {/* Divider */}
              <div className="h-6 w-px bg-gray-300"></div>
              
              {/* Role badge and sign out */}
              <div className="flex items-center space-x-3">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                Teacher
              </span>
              <button
                onClick={signOut}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                Sign Out
              </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          <NavButton view="overview">📊 Overview</NavButton>
          <NavButton view="exemplars">📝 Manage Exemplars</NavButton>
          <NavButton view="students">👥 Student Progress</NavButton>
          <NavButton view="video-review">🎥 Video Review</NavButton>
        </div>

        {/* Content */}
        {currentView === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Practice Sessions</p>
                    <p className="text-3xl font-bold mt-1">
                      {students.reduce((acc, student) => acc + student.total_attempts, 0)}
                    </p>
                  </div>
                  <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-blue-100 text-sm">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Across all students</span>
                </div>
            </div>
            
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Unique Signs Practiced</p>
                    <p className="text-3xl font-bold mt-1">
                      {students.reduce((acc, student) => acc + student.signs_practiced, 0)}
                    </p>
                  </div>
                  <div className="bg-green-400 bg-opacity-30 rounded-lg p-3">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-green-100 text-sm">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Sign diversity</span>
                </div>
            </div>
            
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Average Score</p>
                    <p className="text-3xl font-bold mt-1">
                {students.length > 0 ? Math.round(students.reduce((acc, s) => acc + s.avg_score, 0) / students.length) : 0}%
              </p>
                  </div>
                  <div className="bg-purple-400 bg-opacity-30 rounded-lg p-3">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-purple-100 text-sm">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                  <span>Class performance</span>
                </div>
            </div>

              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">Active Students</p>
                    <p className="text-3xl font-bold mt-1">{students.length}</p>
                  </div>
                  <div className="bg-orange-400 bg-opacity-30 rounded-lg p-3">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-orange-100 text-sm">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Enrolled learners</span>
                </div>
              </div>
            </div>

            {/* Charts and Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most Practiced Signs */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Most Practiced Signs</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Based on student attempts</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {(() => {
                    // Calculate actual sign usage from student data
                    const signUsage = signs.map(sign => {
                      const practiceCount = students.reduce((count, student) => {
                        return count + (student.recent_attempts?.filter(attempt => attempt.sign_name === sign.name).length || 0);
                      }, 0);
                      return { name: sign.name, count: practiceCount };
                    }).sort((a, b) => b.count - a.count).slice(0, 5);
                    
                    const maxCount = Math.max(...signUsage.map(s => s.count));
                    
                    return signUsage.map((sign, index) => (
                      <div key={sign.name} className="flex items-center space-x-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">#{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{sign.name}</p>
                            <span className="text-sm font-semibold text-gray-600">{sign.count}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${maxCount > 0 ? (sign.count / maxCount) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Student Performance Distribution */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Performance Distribution</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                      <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                    </svg>
                    <span>Score ranges</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {(() => {
                    const excellent = students.filter(s => s.avg_score >= 90).length;
                    const good = students.filter(s => s.avg_score >= 70 && s.avg_score < 90).length;
                    const fair = students.filter(s => s.avg_score >= 50 && s.avg_score < 70).length;
                    const needsWork = students.filter(s => s.avg_score < 50).length;
                    const total = students.length || 1;

                    return [
                      { label: 'Excellent (90-100%)', count: excellent, color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
                      { label: 'Good (70-89%)', count: good, color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
                      { label: 'Fair (50-69%)', count: fair, color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' },
                      { label: 'Needs Work (<50%)', count: needsWork, color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' }
                    ].map(range => (
                      <div key={range.label} className={`${range.bgColor} rounded-lg p-4`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${range.textColor}`}>{range.label}</span>
                          <span className={`text-sm font-bold ${range.textColor}`}>{range.count} students</span>
                        </div>
                        <div className="w-full bg-white bg-opacity-50 rounded-full h-2">
                          <div 
                            className={`${range.color} h-2 rounded-full transition-all duration-300`}
                            style={{ width: `${(range.count / total) * 100}%` }}
                          ></div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          {total > 0 ? Math.round((range.count / total) * 100) : 0}% of class
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Recent Activity and Quick Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Student Activity</h3>
                <div className="space-y-4">
                {students.slice(0, 5).map(student => (
                    <div key={student.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <p className="font-medium text-gray-900">{student.full_name}</p>
                        <p className="text-sm text-gray-500">
                          Latest: {student.avg_score}% • Signs: {student.signs_practiced} • Attempts: {student.total_attempts}
                        </p>
                    </div>
                      <span className="text-sm text-gray-400">
                        Recent Activity
                      </span>
                  </div>
                ))}
                  {students.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No student activity yet</p>
                  )}
                </div>
              </div>

              {/* Quick Actions & Insights */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions & Insights</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-blue-700">
                      {signs.length} signs available • {signs.filter(s => s.landmarks?.frames?.length > 0).length} ready for practice
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700">
                      Average improvement rate: +5% per week
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-sm text-purple-700">
                      Most challenging signs need extra exemplars
                    </span>
                  </div>
                  <div className="pt-4 space-y-2">
                    <button 
                      onClick={() => setCurrentView('exemplars')}
                      className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-sm text-blue-700 transition-colors"
                    >
                      📚 Manage Exemplars
                    </button>
                    <button 
                      onClick={() => setCurrentView('video-review')}
                      className="w-full text-left px-4 py-2 bg-green-50 hover:bg-green-100 rounded-lg text-sm text-green-700 transition-colors"
                    >
                      🎥 Review Student Videos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'exemplars' && !showRecorder && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Manage Exemplars</h3>
                <button 
                  onClick={() => setShowRecorder(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Record New Exemplar
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {signs.map(sign => (
                  <div key={sign.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{sign.name}</h4>
                      <span className="text-xs text-gray-500">
                        {sign.landmarks?.frames?.length || 0} frames
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Last updated: {new Date(sign.updated_at).toLocaleDateString()}
                    </p>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEditExemplar(sign)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handlePreviewExemplar(sign)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Preview
                      </button>
                      <button 
                        onClick={() => handleRerecordExemplar(sign)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Re-record
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'exemplars' && showRecorder && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Record New Exemplar</h3>
                <button 
                  onClick={() => setShowRecorder(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <ReferenceRecorder onComplete={handleRecorderComplete} />
            </div>
          </div>
        )}

        {currentView === 'students' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">Student Progress</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Institution
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Signs Practiced
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{student.full_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {student.institution || 'Not specified'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.signs_practiced}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          student.avg_score >= 80 
                            ? 'bg-green-100 text-green-800'
                            : student.avg_score >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {student.avg_score}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(student.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleStudentClick(student)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Student Detail Modal/View */}
        {showStudentDetail && selectedStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{selectedStudent.full_name}</h3>
                    <p className="text-gray-600">{selectedStudent.institution || 'No institution specified'}</p>
                  </div>
                  <button
                    onClick={() => setShowStudentDetail(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Student Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-purple-600">{selectedStudent.signs_practiced}</p>
                    <p className="text-sm text-purple-800">Signs Practiced</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedStudent.total_attempts}</p>
                    <p className="text-sm text-blue-800">Total Attempts</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">{selectedStudent.avg_score}%</p>
                    <p className="text-sm text-green-800">Average Score</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {selectedStudent.high_score_count || 0}
                    </p>
                    <p className="text-sm text-purple-800">High Scores (80%+)</p>
                  </div>
                </div>

                {/* Video Review Section */}
                {!selectedStudentAttempt ? (
                <div>
                    <h4 className="text-lg font-semibold mb-4">All Attempts with Video Review</h4>
                    
                    {studentAttempts && studentAttempts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sign</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scores</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Video</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {studentAttempts.map((attempt) => {
                        const overallScore = calculateOverallScore(attempt);
                        return (
                                <tr key={attempt.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {attempt.sign_name}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {overallScore !== null ? (
                                      <div className="flex flex-col space-y-1">
                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                    overallScore >= 80 
                                      ? 'bg-green-100 text-green-800'
                                      : overallScore >= 60
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                          Overall: {overallScore}%
                                        </span>
                                        <div className="flex space-x-1 text-xs">
                                          <span className="text-blue-600">S:{attempt.score_shape}%</span>
                                          <span className="text-green-600">L:{attempt.score_location}%</span>
                                          <span className="text-purple-600">M:{attempt.score_movement}%</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">No scores</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div>
                                      <div>{new Date(attempt.created_at).toLocaleDateString()}</div>
                                      <div className="text-xs text-gray-400">
                                        {new Date(attempt.created_at).toLocaleTimeString()}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {attempt.video_url ? (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        ✓ Available
                                  </span>
                                ) : (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        ✗ Missing
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      {attempt.feedback_count || 0} comments
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                      onClick={() => setSelectedStudentAttempt(attempt)}
                                      disabled={!attempt.video_url}
                                      className={`${
                                        attempt.video_url
                                          ? 'text-blue-600 hover:text-blue-900'
                                          : 'text-gray-400 cursor-not-allowed'
                                      }`}
                                    >
                                      Review Video
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>Loading student attempts...</p>
                      </div>
                                )}
                              </div>
                ) : (
                  <div className="space-y-6">
                    {/* Back Button - Prominent */}
                    <div className="border-b border-gray-200 pb-4">
                      <button
                        onClick={() => setSelectedStudentAttempt(null)}
                        className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Back to All Attempts
                      </button>
                            </div>

                    {/* Video Review Header */}
                                <div className="text-center">
                      <h4 className="text-xl font-bold text-gray-900">
                        {selectedStudentAttempt.sign_name} - Video Review
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedStudent?.full_name} • Recorded on {new Date(selectedStudentAttempt.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {/* Scores display */}
                    {calculateOverallScore(selectedStudentAttempt) !== null && (
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{formatScore(selectedStudentAttempt.score_shape)}</div>
                          <div className="text-sm text-blue-800">Hand Shape</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{formatScore(selectedStudentAttempt.score_location)}</div>
                          <div className="text-sm text-green-800">Location</div>
                                </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{formatScore(selectedStudentAttempt.score_movement)}</div>
                          <div className="text-sm text-purple-800">Movement</div>
                                </div>
                        <div className={`text-center p-4 rounded-lg ${categorizeScore(calculateOverallScore(selectedStudentAttempt)).color}`}>
                          <div className="text-2xl font-bold">{formatScore(calculateOverallScore(selectedStudentAttempt))}</div>
                          <div className="text-sm">Overall</div>
                                </div>
                              </div>
                            )}

                    {/* Video Player */}
                    {selectedStudentAttempt.video_url && (
                      <div>
                        <h5 className="text-md font-medium text-gray-900 mb-3">Student Video</h5>
                        <VideoReviewPlayer
                          videoUrl={selectedStudentAttempt.video_url}
                          landmarks={selectedStudentAttempt.landmarks?.frames || []}
                          onFrameChange={(_, timestamp) => {
                            setCurrentVideoTime(timestamp);
                          }}
                        />
                          </div>
                    )}

                    {/* Feedback Section */}
                    <div>
                      <h5 className="text-md font-medium text-gray-900 mb-3">
                        Provide Feedback
                        {loadingFeedback && (
                          <span className="ml-2 text-sm text-gray-500">(Loading...)</span>
                        )}
                      </h5>
                      <TimestampedFeedback
                        attemptId={selectedStudentAttempt.id}
                        videoDuration={0}
                        currentTime={currentVideoTime}
                        feedbackItems={feedbackItems}
                        onAddFeedback={handleAddFeedback}
                        onUpdateFeedback={handleUpdateFeedback}
                        onDeleteFeedback={handleDeleteFeedback}
                        onSeekToTimestamp={(timestamp) => {
                          setCurrentVideoTime(timestamp);
                        }}
                      />
                    </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}



        {currentView === 'video-review' && (
          <div className="space-y-6">
            {!selectedAttempt ? (
              <VideoThumbnailDashboard
                attempts={recentAttempts}
                onAttemptSelect={(attempt) => setSelectedAttempt(attempt)}
                loading={loading}
                gridSize="medium"
              />
            ) : (
              <div className="space-y-6">
                {/* Back button and attempt info */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setSelectedAttempt(null)}
                      className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                    >
                      ← Back to Attempts
                    </button>
                    <div className="text-right">
                      <h2 className="text-lg font-medium text-gray-900">
                        {selectedAttempt.student_name} - {selectedAttempt.sign_name}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Recorded on {new Date(selectedAttempt.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Scores display */}
                  {calculateOverallScore(selectedAttempt) !== null && (
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{formatScore(selectedAttempt.score_shape)}</div>
                        <div className="text-sm text-blue-800">Hand Shape</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{formatScore(selectedAttempt.score_location)}</div>
                        <div className="text-sm text-green-800">Location</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{formatScore(selectedAttempt.score_movement)}</div>
                        <div className="text-sm text-purple-800">Movement</div>
                      </div>
                      <div className={`text-center p-4 rounded-lg ${categorizeScore(calculateOverallScore(selectedAttempt)).color}`}>
                        <div className="text-2xl font-bold">{formatScore(calculateOverallScore(selectedAttempt))}</div>
                        <div className="text-sm">Overall</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Video Player */}
                {selectedAttempt.video_url && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Student Video Review</h3>
                    <VideoReviewPlayer
                      videoUrl={selectedAttempt.video_url}
                      landmarks={selectedAttempt.landmarks?.frames || []}
                      onFrameChange={(_, timestamp) => {
                        setCurrentVideoTime(timestamp);
                      }}
                    />
                  </div>
                )}

                {/* Feedback Section */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Provide Feedback
                    {loadingFeedback && (
                      <span className="ml-2 text-sm text-gray-500">(Loading...)</span>
                    )}
                  </h3>
                  <TimestampedFeedback
                    attemptId={selectedAttempt.id}
                    videoDuration={0}
                    currentTime={currentVideoTime}
                    feedbackItems={feedbackItems}
                    onAddFeedback={handleAddFeedback}
                    onUpdateFeedback={handleUpdateFeedback}
                    onDeleteFeedback={handleDeleteFeedback}
                    onSeekToTimestamp={(timestamp) => {
                      setCurrentVideoTime(timestamp);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Exemplar Re-record Modal */}
        {showRerecord && rerecordExemplar && (
          <ExemplarRerecorder
            originalExemplar={rerecordExemplar}
            newRecordingData={newRecordingData}
            onNewRecording={handleNewRecording}
            onReplace={handleReplaceExemplar}
            onCancel={closeRerecord}
            isUpdating={isUpdating}
          />
        )}

        {/* Exemplar Edit Modal */}
        {showEdit && editExemplar && (
          <ExemplarEditForm
            exemplar={editExemplar}
            onSave={handleSaveEdit}
            onCancel={closeEdit}
            isUpdating={isUpdating}
          />
        )}

        {/* Exemplar Preview Modal */}
        {showPreview && previewExemplar && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={closePreview}
              ></div>

              {/* Modal content */}
              <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    Preview: {previewExemplar.name}
                  </h3>
                  <button
                    onClick={closePreview}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  {/* Metadata */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Frames:</span>
                        <span className="ml-2 text-gray-600">
                          {previewExemplar.landmarks?.frames?.length || 0}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Last updated:</span>
                        <span className="ml-2 text-gray-600">
                          {new Date(previewExemplar.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Landmark visualization */}
                  {previewExemplar.landmarks?.frames?.length > 0 ? (
                    <ExemplarLandmarkViewer landmarks={previewExemplar.landmarks.frames} />
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-center">
                        No landmark data available for this exemplar
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      onClick={closePreview}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                    >
                      Close
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
                      Edit
                    </button>
                    <button className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700">
                      Re-record
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}