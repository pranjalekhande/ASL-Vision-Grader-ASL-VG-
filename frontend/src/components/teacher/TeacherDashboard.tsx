import React, { useState, useEffect } from 'react';
import { useAuth2FA } from '../../hooks/useAuth2FA';
import { supabase } from '../../config/supabase';
import { ReferenceRecorder } from '../signs/ReferenceRecorder';

type DashboardView = 'overview' | 'exemplars' | 'students' | 'analytics';

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

  useEffect(() => {
    loadDashboardData();
  }, []);

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
      } else {
        console.log('No students found in database');
        setStudents([]);
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

  // Temporary helper function for testing - creates a demo student entry
  const createTestStudent = async () => {
    try {
      // Check if we can modify the current user's role for testing
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Creating test student data...');
        
        // Note: In a real app, you'd create a separate student account
        // For now, we'll show instructions in the console
        console.log('To test student functionality:');
        console.log('1. Sign out from teacher account');
        console.log('2. Create a new account');
        console.log('3. Set the role to "student" in the database');
        console.log('4. Record some practice attempts');
        console.log('5. Switch back to teacher account to view data');
        
        alert('Check console for instructions on testing student functionality');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const calculateOverallScore = (attempt: StudentAttempt) => {
    if (!attempt.score_shape || !attempt.score_location || !attempt.score_movement) {
      return null;
    }
    return Math.round((attempt.score_shape + attempt.score_location + attempt.score_movement) / 3);
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
        {/* Navigation */}
        <div className="flex space-x-4 mb-8">
          <NavButton view="overview">Overview</NavButton>
          <NavButton view="exemplars">Manage Exemplars</NavButton>
          <NavButton view="students">Student Progress</NavButton>
          <NavButton view="analytics">Analytics</NavButton>
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
                {students.length > 0 ? (
                  students.slice(0, 5).map(student => (
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
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No students yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Students need to sign up with role "student" to appear here.</p>
                    <div className="mt-4 text-xs text-gray-400">
                      <p>To test student features:</p>
                      <p>1. Create a new account with role: "student"</p>
                      <p>2. Record some practice attempts</p>
                      <p>3. View them here in the teacher dashboard</p>
                    </div>
                  </div>
                )}
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
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Student Progress</h3>
                <div className="text-sm text-gray-500">
                  {students.length} student{students.length !== 1 ? 's' : ''} enrolled
                </div>
              </div>
            </div>
            
            {students.length > 0 ? (
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
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
            ) : (
              <div className="p-12 text-center">
                <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No Students Enrolled</h3>
                <p className="mt-2 text-sm text-gray-500">
                  When students sign up and start practicing, their progress will appear here.
                </p>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900">How to get students started:</h4>
                  <ol className="mt-2 text-sm text-blue-700 list-decimal list-inside space-y-1">
                    <li>Students create accounts with role "student"</li>
                    <li>They can practice any available signs</li>
                    <li>Their attempts and scores will be tracked here</li>
                    <li>Click "View Details" to see individual progress</li>
                  </ol>
                  <button
                    onClick={createTestStudent}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    Show Testing Instructions
                  </button>
                </div>
              </div>
            )}
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
                {signs.slice(0, 5).map((sign) => (
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
      </div>
    </div>
  );
}