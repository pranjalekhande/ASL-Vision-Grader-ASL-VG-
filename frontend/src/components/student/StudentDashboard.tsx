import { useState, useEffect } from 'react';
import { VideoRecorder } from '../video/VideoRecorder';
import { SignComparison } from '../comparison/SignComparison';
import { HeatmapVideoPlayer } from '../visualization/HeatmapVideoPlayer';
import type { HandLandmarkFrame, RecordingData } from '../../types/landmarks';
import { supabase } from '../../config/supabase';
import { SupabaseService } from '../../services/supabase';
import { useSignComparison } from '../../hooks/useSignComparison';
import { useAuth2FA } from '../../hooks/useAuth2FA';


interface Sign {
  id: string;
  name: string;
  landmarks: any;
}

interface AttemptData {
  studentFrames: HandLandmarkFrame[];
  referenceFrames: HandLandmarkFrame[];
  signName: string;
}

export function StudentDashboard() {
  const { profile, signOut } = useAuth2FA();
  const [activeTab, setActiveTab] = useState<'practice' | 'history' | 'progress'>('practice');
  const [signs, setSigns] = useState<Sign[]>([]);
  const [selectedSignId, setSelectedSignId] = useState<string>('');
  const [recordedData, setRecordedData] = useState<AttemptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastRecordedBlob, setLastRecordedBlob] = useState<Blob | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);
  const [showHeatmapViewer, setShowHeatmapViewer] = useState(false);
  
  const { compareSign } = useSignComparison();

  useEffect(() => {
    loadSigns();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadAttempts();
    }
  }, [activeTab]);

  const loadSigns = async () => {
    try {
      const { data, error } = await supabase
        .from('signs')
        .select('id, name, landmarks')
        .order('name');
      
      if (error) throw error;
      setSigns(data || []);
      
      // Auto-select first sign if available
      if (data && data.length > 0 && !selectedSignId) {
        setSelectedSignId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading signs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttempts = async () => {
    setLoadingAttempts(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('attempts')
        .select(`
          id,
          created_at,
          video_url,
          score_shape,
          score_location,
          score_movement,
          heatmap,
          landmarks,
          signs(name)
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading attempts:', error);
        return;
      }

      setAttempts(data || []);
    } catch (error) {
      console.error('Error loading attempts:', error);
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleRecordingComplete = async (blob: Blob, landmarks: HandLandmarkFrame[]) => {
    const selectedSign = signs.find(s => s.id === selectedSignId);
    if (!selectedSign) return;

    try {
      // Store the video blob for potential saving
      setLastRecordedBlob(blob);
      
      // Get reference frames from selected sign
      let referenceFrames = landmarks; // Fallback to self-comparison
      const exemplar = selectedSign.landmarks;
      
      if (exemplar?.frames?.length) {
        referenceFrames = exemplar.frames;
      } else if (Array.isArray(exemplar) && exemplar.length) {
        referenceFrames = exemplar;
      }

      setRecordedData({
        studentFrames: landmarks,
        referenceFrames,
        signName: selectedSign.name
      });
      
    } catch (error) {
      console.error('Error processing recording:', error);
      alert('Error processing your recording. Please try again.');
    }
  };

  const handleSaveAttempt = async () => {
    if (!recordedData || !lastRecordedBlob || !selectedSignId) {
      alert('No recording to save. Please record an attempt first.');
      return;
    }

    setIsSaving(true);
    
    try {
      // Convert recorded data to the format expected by SupabaseService
      const recordingData: RecordingData = {
        startTime: Date.now() - (recordedData.studentFrames.length * 100),
        endTime: Date.now(),
        duration: recordedData.studentFrames.length * 100,
        frameRate: 10,
        frames: recordedData.studentFrames,
        metadata: {
          width: 1280,
          height: 720,
          frameCount: recordedData.studentFrames.length
        }
      };

      // Get reference sign data for comparison
      const selectedSign = signs.find(s => s.id === selectedSignId);
      let scores = null;
      
      if (selectedSign && selectedSign.landmarks?.frames?.length > 0) {
        try {
          // Create exemplar data from reference sign
          const exemplarData: RecordingData = {
            startTime: 0,
            endTime: selectedSign.landmarks.frames.length * 100,
            duration: selectedSign.landmarks.frames.length * 100,
            frameRate: 10,
            frames: selectedSign.landmarks.frames,
            metadata: {
              width: 1280,
              height: 720,
              frameCount: selectedSign.landmarks.frames.length
            }
          };

          // Calculate DTW scores

          const comparison = await compareSign(recordingData, exemplarData);

          
          scores = {
            score_shape: Math.round(comparison.handshapeScore * 100) / 100,
            score_location: Math.round(comparison.locationScore * 100) / 100,
            score_movement: Math.round(comparison.movementScore * 100) / 100,
            heatmap: comparison.heatmap
          };
          

        } catch (scoreError) {
          console.error('Error calculating scores:', scoreError);
          // Continue with save even if scoring fails
        }
      }

      // Save attempt to database with real service (including scores)

      const attempt = await SupabaseService.uploadAttempt({
        signId: selectedSignId,
        videoBlob: lastRecordedBlob,
        landmarkData: recordingData,
        scores: scores || undefined // Include scores in initial save
      });
      console.log('✅ Attempt saved successfully:', attempt.id);
      
      const scoreMessage = scores 
        ? `\n🎯 Scores: Shape ${scores.score_shape}%, Location ${scores.score_location}%, Movement ${scores.score_movement}%`
        : '';
      
      alert(`✅ Attempt saved successfully! Check your history to see it.${scoreMessage}`);
      
      // Clear the current recording after successful save
      setRecordedData(null);
      setLastRecordedBlob(null);
      
      // Refresh attempts if on history tab
      if (activeTab === 'history') {
        loadAttempts();
      }
      
    } catch (error) {
      console.error('Error saving attempt:', error);
      alert('❌ Failed to save attempt. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewAttempt = (attempt: any) => {
    setSelectedAttempt(attempt);
    setShowHeatmapViewer(true);
  };

  const TabButton = ({ label, active, onClick }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors ${
        active
          ? 'bg-green-500 text-white'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
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
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">ASL</span>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">Vision Grader</h1>
              </div>
              <span className="text-gray-400">|</span>
              <span className="text-lg font-medium text-gray-700">Student Dashboard</span>
            </div>
            
            {/* Right side - User info and actions */}
            <div className="flex items-center space-x-4">
              {/* User info */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                  <p className="text-xs text-gray-500">Student Account</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-medium text-sm">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
                  </span>
                </div>
              </div>
              
              {/* Divider */}
              <div className="h-6 w-px bg-gray-300"></div>
              
              {/* Role badge and sign out */}
              <div className="flex items-center space-x-3">
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                  Student
                </span>
                <button
                  onClick={signOut}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
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
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Practice ASL Signs</h2>
          <p className="text-gray-600 mt-2">Record your signs and get instant feedback to improve your ASL skills</p>
        </div>

      {/* Navigation Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex space-x-1">
          <TabButton
            label="Practice"
            active={activeTab === 'practice'}
            onClick={() => setActiveTab('practice')}
          />
          <TabButton
            label="My Attempts"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
          <TabButton
            label="Progress"
            active={activeTab === 'progress'}
            onClick={() => setActiveTab('progress')}
          />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'practice' && (
        <div className="space-y-6">
          {!recordedData ? (
            /* Practice Interface */
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4">Practice a Sign</h3>
              
              {/* Sign Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose a sign to practice:
                </label>
                <select
                  value={selectedSignId}
                  onChange={(e) => setSelectedSignId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {signs.map((sign) => (
                    <option key={sign.id} value={sign.id}>
                      {sign.name} {!sign.landmarks?.frames?.length && '(No exemplar yet)'}
                    </option>
                  ))}
                </select>
                {selectedSignId && !signs.find(s => s.id === selectedSignId)?.landmarks?.frames?.length && (
                  <p className="mt-2 text-sm text-orange-600">
                    ⚠️ This sign doesn't have an exemplar yet. Your recording will be compared to itself.
                  </p>
                )}
              </div>

              {/* Recording Area */}
              <VideoRecorder
                onRecordingComplete={handleRecordingComplete}
                maxDuration={5}
              />
            </div>
          ) : (
            /* Results Interface */
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold">
                    Practice Results: {recordedData.signName}
                  </h3>
                  <button
                    onClick={() => {
                      setRecordedData(null);
                      setLastRecordedBlob(null);
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 mr-3"
                  >
                    Practice Again
                  </button>
                  <button
                    onClick={handleSaveAttempt}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save Attempt'}
                  </button>
                </div>
              </div>
              
              <SignComparison
                referenceFrames={recordedData.referenceFrames}
                studentFrames={recordedData.studentFrames}
                signMetadata={{
                  name: recordedData.signName,
                  description: `Practice attempt for ${recordedData.signName}`,
                  difficulty: 1,
                  common_mistakes: {
                    handshape: ["Keep fingers properly positioned"],
                    movement: ["Move smoothly and consistently"],
                    location: ["Maintain proper hand position"]
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Practice History</h3>
              <button
                onClick={loadAttempts}
                disabled={loadingAttempts}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingAttempts ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {loadingAttempts ? (
              <div className="text-center py-8">
                <div className="text-gray-500">Loading your attempts...</div>
              </div>
            ) : attempts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-2">No attempts yet</div>
                <p className="text-sm text-gray-400">
                  Practice some signs and your attempts will appear here!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {attempts.map((attempt) => (
                  <div key={attempt.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {attempt.signs?.name || 'Unknown Sign'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {new Date(attempt.created_at).toLocaleDateString()} at {new Date(attempt.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex space-x-3">
                        {attempt.video_url && (
                          <a
                            href={attempt.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View Video
                          </a>
                        )}
                        {attempt.video_url && attempt.heatmap && attempt.landmarks && (
                          <button
                            onClick={() => handleViewAttempt(attempt)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            View Heatmap
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Scores */}
                    {(attempt.score_shape || attempt.score_location || attempt.score_movement) ? (
                      <div className="grid grid-cols-3 gap-4 mt-3">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {attempt.score_shape ? `${attempt.score_shape}%` : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">Shape</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {attempt.score_location ? `${attempt.score_location}%` : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">Location</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {attempt.score_movement ? `${attempt.score_movement}%` : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">Movement</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        No scores available
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Signs Available</h3>
              <p className="text-3xl font-bold text-green-600">{signs.length}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Signs with Exemplars</h3>
              <p className="text-3xl font-bold text-blue-600">
                {signs.filter(s => s.landmarks?.frames?.length > 0).length}
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Practice Sessions</h3>
              <p className="text-3xl font-bold text-purple-600">{attempts.length}</p>
              <p className="text-sm text-gray-500">Total attempts</p>
            </div>
          </div>

          {/* Available Signs */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Available Signs</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {signs.map((sign) => (
                <div key={sign.id} className="p-6 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-gray-900">{sign.name}</h4>
                    <p className="text-sm text-gray-500">
                      {sign.landmarks?.frames?.length > 0
                        ? 'Ready to practice'
                        : 'Waiting for teacher exemplar'
                      }
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {sign.landmarks?.frames?.length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Coming Soon
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedSignId(sign.id);
                        setActiveTab('practice');
                      }}
                      disabled={!sign.landmarks?.frames?.length}
                      className="text-green-600 hover:text-green-800 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      Practice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Viewer Modal */}
      {showHeatmapViewer && selectedAttempt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Heatmap Analysis: {selectedAttempt.signs?.name || 'Unknown Sign'}
                  </h3>
                  <p className="text-gray-600">
                    {new Date(selectedAttempt.created_at).toLocaleDateString()} at{' '}
                    {new Date(selectedAttempt.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => setShowHeatmapViewer(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Score Summary */}
              {(selectedAttempt.score_shape || selectedAttempt.score_location || selectedAttempt.score_movement) && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">
                      {selectedAttempt.score_shape ? `${selectedAttempt.score_shape}%` : 'N/A'}
                    </p>
                    <p className="text-sm text-green-800">Shape Accuracy</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {selectedAttempt.score_location ? `${selectedAttempt.score_location}%` : 'N/A'}
                    </p>
                    <p className="text-sm text-blue-800">Location Accuracy</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">
                      {selectedAttempt.score_movement ? `${selectedAttempt.score_movement}%` : 'N/A'}
                    </p>
                    <p className="text-sm text-purple-800">Movement Accuracy</p>
                  </div>
                </div>
              )}

              {/* Heatmap Video Player */}
              {selectedAttempt.video_url && selectedAttempt.heatmap && selectedAttempt.landmarks && (
                <HeatmapVideoPlayer
                  videoUrl={selectedAttempt.video_url}
                  heatmapData={selectedAttempt.heatmap || []}
                  landmarkData={selectedAttempt.landmarks?.frames || []}
                  showLandmarks={true}
                  className="w-full"
                />
              )}

              {(!selectedAttempt.video_url || !selectedAttempt.heatmap || !selectedAttempt.landmarks) && (
                <div className="text-center py-8 text-gray-500">
                  <p>Heatmap data not available for this attempt</p>
                  <p className="text-sm">This may be an older recording before heatmap generation was implemented.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}