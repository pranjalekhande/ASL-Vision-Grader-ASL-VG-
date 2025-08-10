import React, { useState, useEffect } from 'react';
import { useAuth2FA } from '../../hooks/useAuth2FA';
import { supabase } from '../../config/supabase';
import { SynchronizedVideoComparison } from './SynchronizedVideoComparison';
import { VideoReviewPlayer } from './VideoReviewPlayer';
import { TimestampedFeedback } from './TimestampedFeedback';
import { LandmarkDifferenceVisualization } from './LandmarkDifferenceVisualization';

import type { HandLandmarkFrame } from '../../types/landmarks';

type DashboardView = 'overview' | 'review' | 'analytics' | 'feedback-templates';

interface StudentAttempt {
  id: string;
  student_id: string;
  student_name: string;
  sign_id: string;
  sign_name: string;
  score_shape: number | null;
  score_location: number | null;
  score_movement: number | null;
  created_at: string;
  video_url: string | null;
  landmarks: any;
  feedback_count: number;
}

interface AnalyticsData {
  totalStudents: number;
  totalAttempts: number;
  avgScore: number;
  feedbackGiven: number;
  recentActivity: Array<{
    date: string;
    attempts: number;
    avgScore: number;
  }>;
  topSigns: Array<{
    name: string;
    attempts: number;
    avgScore: number;
  }>;
  strugglingStudents: Array<{
    name: string;
    avgScore: number;
    needsAttention: boolean;
  }>;
}

export function EnhancedTeacherDashboard() {
  const { profile, signOut } = useAuth2FA();
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [selectedAttempt, setSelectedAttempt] = useState<StudentAttempt | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<StudentAttempt[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackItems, setFeedbackItems] = useState<any[]>([]);
  const [currentVideoTime, setCurrentVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load recent attempts that need review (simplified query)
      const { data: attempts } = await supabase
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

      // Get additional data separately to avoid complex joins
      let enrichedAttempts = [];
      if (attempts) {
        enrichedAttempts = await Promise.all(
          attempts.map(async (attempt) => {
            // Get student name
            const { data: student } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', attempt.student_id)
              .single();

            // Get sign name
            const { data: sign } = await supabase
              .from('signs')
              .select('name')
              .eq('id', attempt.sign_id)
              .single();

            // Get feedback count (if table exists)
            let feedbackCount = 0;
            try {
              const { data: feedback } = await supabase
                .from('feedback')
                .select('id')
                .eq('attempt_id', attempt.id);
              feedbackCount = feedback?.length || 0;
            } catch (error) {
              // Feedback table doesn't exist yet
            }

            return {
              ...attempt,
              student_name: student?.full_name || 'Unknown',
              sign_name: sign?.name || 'Unknown',
              feedback_count: feedbackCount
            };
          })
        );
      }

      // Use enriched attempts data
      setRecentAttempts(enrichedAttempts);

      // Load analytics data
      const analyticsData = await loadAnalyticsData();
      setAnalytics(analyticsData);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalyticsData = async (): Promise<AnalyticsData> => {
    try {
      // Load basic data from existing tables only
      const [studentsRes, attemptsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'student'),
        supabase.from('attempts').select('*')
      ]);

      const totalStudents = studentsRes.data?.length || 0;
      const totalAttempts = attemptsRes.data?.length || 0;

      // Calculate average score from existing attempts
      const validAttempts = attemptsRes.data?.filter(a => 
        a.score_shape && a.score_location && a.score_movement
      ) || [];
      const avgScore = validAttempts.length > 0 
        ? validAttempts.reduce((sum, a) => 
            sum + (a.score_shape + a.score_location + a.score_movement) / 3, 0
          ) / validAttempts.length
        : 0;

      // Try to get feedback count (might not exist yet)
      let totalFeedback = 0;
      try {
        const feedbackRes = await supabase.from('feedback').select('id');
        totalFeedback = feedbackRes.data?.length || 0;
      } catch (error) {
        console.log('Feedback table not yet created');
      }

      // Calculate basic analytics from attempts
      const recentActivity = [];
      const strugglingStudents = [];

      return {
        totalStudents,
        totalAttempts,
        avgScore: Math.round(avgScore),
        feedbackGiven: totalFeedback,
        recentActivity,
        topSigns: [],
        strugglingStudents
      };
    } catch (error) {
      console.error('Error loading analytics:', error);
      return {
        totalStudents: 0,
        totalAttempts: 0,
        avgScore: 0,
        feedbackGiven: 0,
        recentActivity: [],
        topSigns: [],
        strugglingStudents: []
      };
    }
  };

  const loadFeedbackForAttempt = async (attemptId: string) => {
    try {
      const { data } = await supabase
        .from('feedback')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('timestamp_seconds');
      
      setFeedbackItems(data || []);
    } catch (error) {
      console.log('Feedback table not yet created, using empty feedback list');
      setFeedbackItems([]);
    }
  };

  const handleAttemptSelect = async (attempt: StudentAttempt) => {
    setSelectedAttempt(attempt);
    setCurrentView('review');
    await loadFeedbackForAttempt(attempt.id);
  };

  const handleAddFeedback = async (feedback: any) => {
    if (!selectedAttempt) return;

    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          attempt_id: selectedAttempt.id,
          teacher_id: profile?.id,
          ...feedback
        });

      if (!error) {
        await loadFeedbackForAttempt(selectedAttempt.id);
      }
    } catch (error) {
      console.error('Feedback functionality not yet available:', error);
      alert('Feedback system is not yet set up. Please run the database migrations first.');
    }
  };

  const handleUpdateFeedback = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update(updates)
        .eq('id', id);

      if (!error && selectedAttempt) {
        await loadFeedbackForAttempt(selectedAttempt.id);
      }
    } catch (error) {
      console.error('Feedback update failed:', error);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (!error && selectedAttempt) {
        await loadFeedbackForAttempt(selectedAttempt.id);
      }
    } catch (error) {
      console.error('Feedback deletion failed:', error);
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

  const getOverallScore = (attempt: StudentAttempt) => {
    if (!attempt.score_shape || !attempt.score_location || !attempt.score_movement) return null;
    return Math.round((attempt.score_shape + attempt.score_location + attempt.score_movement) / 3);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading enhanced dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Enhanced Teacher Dashboard</h1>
              <p className="text-sm text-gray-600">Welcome, {profile?.full_name}</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-medium">
                Teacher
              </span>
              <button
                onClick={signOut}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <div className="flex space-x-4 mb-8">
          <NavButton view="overview">Overview</NavButton>
          <NavButton view="review">Video Review</NavButton>
          <NavButton view="analytics">Analytics</NavButton>
          <NavButton view="feedback-templates">Templates</NavButton>
        </div>

        {/* Content */}
        {currentView === 'overview' && analytics && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Students</h3>
                <p className="text-3xl font-bold text-blue-600">{analytics.totalStudents}</p>
                <p className="text-sm text-gray-500">Active learners</p>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Attempts</h3>
                <p className="text-3xl font-bold text-green-600">{analytics.totalAttempts}</p>
                <p className="text-sm text-gray-500">Total practice sessions</p>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Avg. Score</h3>
                <p className="text-3xl font-bold text-purple-600">{analytics.avgScore}%</p>
                <p className="text-sm text-gray-500">Class average</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Feedback</h3>
                <p className="text-3xl font-bold text-orange-600">{analytics.feedbackGiven}</p>
                <p className="text-sm text-gray-500">Comments provided</p>
              </div>
            </div>

            {/* Recent Attempts Needing Review */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h3 className="text-lg font-medium text-gray-900">Recent Attempts</h3>
                <p className="text-sm text-gray-600">Click on any attempt to provide detailed feedback</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sign</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Feedback</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentAttempts.map(attempt => {
                      const overallScore = getOverallScore(attempt);
                      return (
                        <tr key={attempt.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{attempt.student_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {attempt.sign_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {overallScore !== null ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                overallScore >= 80 
                                  ? 'bg-green-100 text-green-800'
                                  : overallScore >= 60
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {overallScore}%
                              </span>
                            ) : (
                              <span className="text-gray-500 text-sm">No scores</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              attempt.feedback_count > 0
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {attempt.feedback_count} comments
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(attempt.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleAttemptSelect(attempt)}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Struggling Students Alert */}
            {analytics.strugglingStudents.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-yellow-800 mb-2">Students Needing Attention</h3>
                <div className="space-y-2">
                  {analytics.strugglingStudents.map((student, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-yellow-900">{student.name}</span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        student.needsAttention ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {student.avgScore}% avg
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}


          </div>
        )}

        {currentView === 'review' && selectedAttempt && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">
                Review: {selectedAttempt.student_name} - {selectedAttempt.sign_name}
              </h2>
              
              {selectedAttempt.video_url && (
                <div className="space-y-6">
                  {/* Student Video Player */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Student Video Review</h3>
                    <VideoReviewPlayer
                      videoUrl={selectedAttempt.video_url}
                      landmarks={selectedAttempt.landmarks?.frames || []}
                      width={640}
                      height={480}
                      onFrameChange={(frameIndex, timestamp) => {
                        setCurrentVideoTime(timestamp);
                      }}
                      showLandmarks={true}
                      playbackSpeed={1.0}
                    />
                  </div>

                  {/* Landmark Analysis (if we have landmark data) */}
                  {selectedAttempt.landmarks?.frames && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Landmark Analysis</h3>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <p className="text-yellow-800 text-sm">
                          <strong>Note:</strong> Landmark comparison requires exemplar data. 
                          Currently showing student landmarks only.
                        </p>
                      </div>
                      {/* Could add individual landmark visualization here */}
                      <div className="bg-gray-100 rounded-lg p-6 text-center">
                        <p className="text-gray-600">Individual landmark visualization</p>
                        <p className="text-sm text-gray-500">
                          {selectedAttempt.landmarks.frames.length} frames of landmark data available
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Timestamped Feedback */}
                  <TimestampedFeedback
                    attemptId={selectedAttempt.id}
                    videoDuration={videoDuration || 7} // Use actual duration or fallback to 7 seconds
                    currentTime={currentVideoTime}
                    feedbackItems={feedbackItems}
                    onAddFeedback={handleAddFeedback}
                    onUpdateFeedback={handleUpdateFeedback}
                    onDeleteFeedback={handleDeleteFeedback}
                    onSeekToTimestamp={(timestamp) => {
                      setCurrentVideoTime(timestamp);
                      // Note: Would need video player ref to actually seek
                      console.log('Seeking to:', timestamp);
                    }}
                  />
                </div>
              )}
              
              {!selectedAttempt.video_url && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                  <h3 className="text-lg font-medium text-red-800 mb-2">Video Not Available</h3>
                  <p className="text-red-700 mb-4">
                    The video for this attempt is not available or was not properly uploaded.
                  </p>
                  
                  <div className="mt-4 text-sm text-red-600 space-y-2">
                    <p><strong>Attempt ID:</strong> {selectedAttempt.id}</p>
                    <p><strong>Created:</strong> {new Date(selectedAttempt.created_at).toLocaleString()}</p>
                    <p><strong>Student:</strong> {selectedAttempt.student_name}</p>
                    <p><strong>Sign:</strong> {selectedAttempt.sign_name}</p>
                  </div>

                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded text-left">
                    <h4 className="font-medium text-yellow-800 mb-2">Possible Causes:</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Video upload was interrupted during student recording</li>
                      <li>• Student's browser doesn't support video recording</li>
                      <li>• Network issues during upload</li>
                      <li>• Storage bucket permissions not configured</li>
                    </ul>
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => setCurrentView('overview')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      ← Back to Attempts
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'analytics' && analytics && (
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-6">Analytics Dashboard</h2>
              
              {/* Recent Activity Chart */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Weekly Activity</h3>
                <div className="bg-gray-100 rounded-lg p-6 text-center">
                  <p className="text-gray-600">Activity chart would appear here</p>
                  <p className="text-sm text-gray-500">Integration with charting library needed</p>
                  <div className="mt-4 text-sm text-gray-600">
                    Data: {analytics.recentActivity.length} weeks of data available
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <h4 className="font-semibold text-blue-900 mb-2">Class Performance</h4>
                  <div className="text-3xl font-bold text-blue-600 mb-2">{analytics.avgScore}%</div>
                  <p className="text-blue-700 text-sm">Average score across all attempts</p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-6">
                  <h4 className="font-semibold text-green-900 mb-2">Engagement</h4>
                  <div className="text-3xl font-bold text-green-600 mb-2">{analytics.totalAttempts}</div>
                  <p className="text-green-700 text-sm">Total practice attempts</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'feedback-templates' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-6">Feedback Templates</h2>
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">Template management coming soon</p>
              <p className="text-sm">Create and manage reusable feedback templates</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
