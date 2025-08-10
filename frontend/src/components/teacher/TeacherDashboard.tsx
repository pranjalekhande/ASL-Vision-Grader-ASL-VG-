import React, { useState, useEffect } from 'react';
import { useAuth2FA } from '../../hooks/useAuth2FA';
import { supabase } from '../../config/supabase';
import { ReferenceRecorder } from '../signs/ReferenceRecorder';
import { VideoReviewPlayer } from './VideoReviewPlayer';
import { TimestampedFeedback } from './TimestampedFeedback';

type DashboardView = 'overview' | 'exemplars' | 'students' | 'analytics' | 'video-review' | 'feedback-templates';

interface SignData {
  id: string;
  name: string;
  landmarks: any;
  created_at: string;
  updated_at: string;
}

interface StudentData {
  id: string;
  full_name: string;
  institution?: string;
  created_at: string;
  total_attempts: number;
  avg_score: number;
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

  useEffect(() => {
    loadDashboardData();
  }, []);

  const fixTeacherRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Update the profile role to teacher
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'teacher' })
        .eq('id', user.id);
      
      if (error) {
        console.error('Failed to update role:', error);
      } else {
        console.log('Successfully updated role to teacher');
        // Reload the page to refresh the session
        window.location.reload();
      }
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
            // Get student's attempts with sign names
            const { data: attempts } = await supabase
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
              .limit(5); // Get recent 5 attempts for preview

            const total_attempts = attempts?.length || 0;
            
            // Calculate average score from attempts with valid scores
            const validScores = attempts?.filter(attempt => 
              attempt.score_shape && attempt.score_location && attempt.score_movement
            ) || [];
            
            const avg_score = validScores.length > 0 
              ? Math.round(
                  validScores.reduce((sum, attempt) => 
                    sum + (attempt.score_shape + attempt.score_location + attempt.score_movement) / 3, 0
                  ) / validScores.length
                )
              : 0;

            // Format recent attempts
            const recent_attempts: StudentAttempt[] = attempts?.map(attempt => ({
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
              avg_score,
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
  };


  const calculateOverallScore = (attempt: StudentAttempt) => {
    if (!attempt.score_shape || !attempt.score_location || !attempt.score_movement) {
      return null;
    }
    return Math.round((attempt.score_shape + attempt.score_location + attempt.score_movement) / 3);
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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Teacher Dashboard</h1>
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
        {/* Temporary fix for role */}
        <div className="mb-4 bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <p className="text-yellow-800">If you're seeing no students, your role might be incorrect.</p>
          <button
            onClick={fixTeacherRole}
            className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Fix Teacher Role
          </button>
        </div>

        {/* Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          <NavButton view="overview">📊 Overview</NavButton>
          <NavButton view="exemplars">📝 Manage Exemplars</NavButton>
          <NavButton view="students">👥 Student Progress</NavButton>
          <NavButton view="analytics">📈 Analytics</NavButton>
          <NavButton view="video-review">🎥 Video Review</NavButton>
          <NavButton view="feedback-templates">💬 Feedback Templates</NavButton>
        </div>

        {/* Content */}
        {currentView === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stats Cards */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Total Signs</h3>
              <p className="text-3xl font-bold text-blue-600">{signs.length}</p>
              <p className="text-sm text-gray-500">Available for practice</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Active Students</h3>
              <p className="text-3xl font-bold text-green-600">{students.length}</p>
              <p className="text-sm text-gray-500">Enrolled in your classes</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Avg. Progress</h3>
              <p className="text-3xl font-bold text-purple-600">
                {students.length > 0 ? Math.round(students.reduce((acc, s) => acc + s.avg_score, 0) / students.length) : 0}%
              </p>
              <p className="text-sm text-gray-500">Class average score</p>
            </div>

            {/* Recent Activity */}
            <div className="md:col-span-3 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {students.slice(0, 5).map(student => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{student.full_name}</p>
                      <p className="text-sm text-gray-500">{student.total_attempts} practice attempts</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{student.avg_score}%</p>
                      <p className="text-sm text-gray-500">Average score</p>
                    </div>
                  </div>
                ))}
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
                      <button className="text-blue-600 hover:text-blue-800 text-sm">
                        Edit
                      </button>
                      <button className="text-green-600 hover:text-green-800 text-sm">
                        Preview
                      </button>
                      <button className="text-red-600 hover:text-red-800 text-sm">
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
                      Attempts
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
                        {student.total_attempts}
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
                <div className="grid grid-cols-3 gap-4 mb-6">
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
                      {selectedStudent.recent_attempts?.filter(a => calculateOverallScore(a) && calculateOverallScore(a)! >= 80).length || 0}
                    </p>
                    <p className="text-sm text-purple-800">High Scores (80%+)</p>
                  </div>
                </div>

                {/* Recent Attempts */}
                <div>
                  <h4 className="text-lg font-semibold mb-4">Recent Attempts</h4>
                  {selectedStudent.recent_attempts && selectedStudent.recent_attempts.length > 0 ? (
                    <div className="space-y-3">
                      {selectedStudent.recent_attempts.map(attempt => {
                        const overallScore = calculateOverallScore(attempt);
                        return (
                          <div key={attempt.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-medium text-gray-900">{attempt.sign_name}</h5>
                                <p className="text-sm text-gray-500">
                                  {new Date(attempt.created_at).toLocaleDateString()} at{' '}
                                  {new Date(attempt.created_at).toLocaleTimeString()}
                                </p>
                              </div>
                              <div className="text-right">
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
                                  <span className="text-sm text-gray-500">No scores</span>
                                )}
                              </div>
                            </div>

                            {/* Detailed Scores */}
                            {overallScore !== null && (
                              <div className="mt-3 grid grid-cols-3 gap-4">
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Shape</p>
                                  <p className="font-medium text-blue-600">{attempt.score_shape}%</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Location</p>
                                  <p className="font-medium text-green-600">{attempt.score_location}%</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-sm text-gray-600">Movement</p>
                                  <p className="font-medium text-purple-600">{attempt.score_movement}%</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No attempts yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Most Practiced Signs</h3>
              <div className="space-y-3">
                {signs.slice(0, 5).map(sign => (
                  <div key={sign.id} className="flex items-center justify-between">
                    <span className="text-gray-900">{sign.name}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.random() * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500">{Math.floor(Math.random() * 200)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h3>
              <div className="text-center py-8 text-gray-500">
                <p>Performance charts would go here</p>
                <p className="text-sm">Integration with charting library needed</p>
              </div>
            </div>
          </div>
        )}

        {currentView === 'video-review' && (
          <div className="space-y-6">
            {!selectedAttempt ? (
              <div>
                {/* Recent Attempts List */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Recent Student Attempts</h3>
                    <p className="text-sm text-gray-600">Click on an attempt to review the video and provide feedback</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sign</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scores</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Video</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feedback</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {recentAttempts.map((attempt) => (
                          <tr key={attempt.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {attempt.student_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {attempt.sign_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {attempt.score_shape && attempt.score_location && attempt.score_movement ? (
                                <div className="flex space-x-1">
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    S: {attempt.score_shape}%
                                  </span>
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                    L: {attempt.score_location}%
                                  </span>
                                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    M: {attempt.score_movement}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400">No scores</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(attempt.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {attempt.feedback_count || 0} comments
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                onClick={() => setSelectedAttempt(attempt)}
                                disabled={!attempt.video_url}
                                className={`${
                                  attempt.video_url
                                    ? 'text-blue-600 hover:text-blue-900'
                                    : 'text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {recentAttempts.length === 0 && (
                    <div className="p-6 text-center text-gray-500">
                      <p>No student attempts found.</p>
                      <p className="text-sm">Student recordings will appear here for review.</p>
                    </div>
                  )}
                </div>
              </div>
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
                  {selectedAttempt.score_shape && selectedAttempt.score_location && selectedAttempt.score_movement && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{selectedAttempt.score_shape}%</div>
                        <div className="text-sm text-blue-800">Hand Shape</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{selectedAttempt.score_location}%</div>
                        <div className="text-sm text-green-800">Location</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{selectedAttempt.score_movement}%</div>
                        <div className="text-sm text-purple-800">Movement</div>
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
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Provide Feedback</h3>
                  <TimestampedFeedback
                    attemptId={selectedAttempt.id}
                    videoDuration={0}
                    currentTime={currentVideoTime}
                    feedbackItems={[]}
                    onAddFeedback={async (feedback) => {
                      console.log('Adding feedback:', feedback);
                      // TODO: Implement feedback saving
                    }}
                    onUpdateFeedback={async (id, feedback) => {
                      console.log('Updating feedback:', id, feedback);
                      // TODO: Implement feedback updating
                    }}
                    onDeleteFeedback={async (id) => {
                      console.log('Deleting feedback:', id);
                      // TODO: Implement feedback deletion
                    }}
                    onSeekToTimestamp={(timestamp) => {
                      setCurrentVideoTime(timestamp);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'feedback-templates' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Feedback Templates</h3>
              <p className="text-sm text-gray-600">Create and manage reusable feedback templates</p>
            </div>
            
            <div className="p-6">
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Feedback Templates</h3>
                <p className="mb-4">Create pre-written feedback for common corrections and praise.</p>
                <p className="text-sm">This feature will help you provide consistent, helpful feedback faster.</p>
                
                <div className="mt-8">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Create Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}