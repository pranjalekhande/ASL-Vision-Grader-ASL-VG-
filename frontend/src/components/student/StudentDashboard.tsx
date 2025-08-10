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
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
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
            label="📊 Overview"
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <TabButton
            label="📝 My Attempts"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {!recordedData ? (
            <>
              {/* Personal Statistics Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-100 text-sm font-medium">Total Practice Sessions</p>
                      <p className="text-3xl font-bold mt-1">{attempts.length}</p>
                    </div>
                    <div className="bg-green-400 bg-opacity-30 rounded-lg p-3">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-green-100 text-sm">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Keep practicing!</span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Signs Practiced</p>
                      <p className="text-3xl font-bold mt-1">
                        {new Set(attempts.map(attempt => attempt.signs?.name).filter(Boolean)).size}
                      </p>
                    </div>
                    <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-blue-100 text-sm">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Variety is key</span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium">Average Score</p>
                      <p className="text-3xl font-bold mt-1">
                        {attempts.length > 0 ? Math.round(attempts.reduce((sum, attempt) => {
                          const score = Math.max(attempt.score_shape || 0, attempt.score_location || 0, attempt.score_movement || 0);
                          return sum + score;
                        }, 0) / attempts.length) : 0}%
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
                    <span>Your performance</span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm font-medium">Best Score</p>
                      <p className="text-3xl font-bold mt-1">
                        {attempts.length > 0 ? Math.max(...attempts.map(attempt => 
                          Math.max(attempt.score_shape || 0, attempt.score_location || 0, attempt.score_movement || 0)
                        )) : 0}%
                      </p>
                    </div>
                    <div className="bg-orange-400 bg-opacity-30 rounded-lg p-3">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-orange-100 text-sm">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 010 2h-1v1a1 1 0 01-2 0V4h-1a1 1 0 010-2h1V1a1 1 0 012 0v1h1zm-2 12a1 1 0 011-1h1v-1a1 1 0 112 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <span>Personal record</span>
                  </div>
                </div>
              </div>

              {/* Practice Interface */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold mb-4">🎯 Practice a Sign</h3>
              
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

              {/* Recent Performance and Available Signs Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Performance */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">Recent Performance</h3>
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="space-y-4">
                    {attempts.slice(0, 3).map((attempt, index) => {
                      const score = Math.max(attempt.score_shape || 0, attempt.score_location || 0, attempt.score_movement || 0);
                      return (
                        <div key={attempt.id} className="flex items-center space-x-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 font-semibold text-sm">#{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {(attempt.signs as any)?.name || 'Unknown Sign'}
                              </p>
                              <span className={`text-sm font-semibold ${
                                score >= 80 ? 'text-green-600' : 
                                score >= 60 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {score}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  score >= 80 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                                  score >= 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                                  'bg-gradient-to-r from-red-500 to-red-600'
                                }`}
                                style={{ width: `${score}%` }}
                              ></div>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {new Date(attempt.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {attempts.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>No practice sessions yet</p>
                        <p className="text-sm">Start practicing to see your progress here!</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Available Signs */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">Available Signs</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>{signs.filter(s => s.landmarks?.frames?.length > 0).length} ready to practice</span>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {signs.map((sign) => (
                      <div key={sign.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{sign.name}</h4>
                          <p className="text-sm text-gray-500">
                            {sign.landmarks?.frames?.length > 0
                              ? `${sign.landmarks.frames.length} frames available`
                              : 'Waiting for teacher exemplar'
                            }
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSignId(sign.id);
                            // Scroll to practice section
                            window.scrollTo({ top: 500, behavior: 'smooth' });
                          }}
                          disabled={!sign.landmarks?.frames?.length}
                          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-md hover:bg-green-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {sign.landmarks?.frames?.length > 0 ? 'Practice' : 'Not Ready'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Results Interface */
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold">
                    Practice Results: {recordedData.signName}
                  </h3>
                  <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setRecordedData(null);
                      setLastRecordedBlob(null);
                    }}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
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