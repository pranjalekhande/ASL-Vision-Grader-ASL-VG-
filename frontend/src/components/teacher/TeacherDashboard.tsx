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
  institution: string;
  created_at: string;
  total_attempts: number;
  avg_score: number;
}

export function TeacherDashboard() {
  const { profile, signOut } = useAuth2FA();
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [signs, setSigns] = useState<SignData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load signs
      const { data: signsData } = await supabase
        .from('signs')
        .select('*')
        .order('name');
      
      if (signsData) setSigns(signsData);

      // Load students (only for teachers)
      const { data: studentsData } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          institution,
          created_at
        `)
        .eq('role', 'student')
        .order('full_name');
      
      if (studentsData) {
        // Add mock attempt data for now
        const studentsWithStats = studentsData.map(student => ({
          ...student,
          total_attempts: Math.floor(Math.random() * 50) + 1,
          avg_score: Math.floor(Math.random() * 40) + 60,
        }));
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Most Practiced Signs</h3>
              <div className="space-y-3">
                {signs.slice(0, 5).map((sign, index) => (
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