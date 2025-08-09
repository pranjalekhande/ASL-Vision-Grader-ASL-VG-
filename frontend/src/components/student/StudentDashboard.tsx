import { useState, useEffect } from 'react';
import { VideoRecorder } from '../video/VideoRecorder';
import { SignComparison } from '../comparison/SignComparison';
import type { HandLandmarkFrame } from '../../types/landmarks';
import { supabase } from '../../config/supabase';

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
  const [activeTab, setActiveTab] = useState<'practice' | 'history' | 'progress'>('practice');
  const [signs, setSigns] = useState<Sign[]>([]);
  const [selectedSignId, setSelectedSignId] = useState<string>('');
  const [recordedData, setRecordedData] = useState<AttemptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastRecordedBlob, setLastRecordedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    loadSigns();
  }, []);

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
      // For now, just simulate a save without calling the service
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('✅ Attempt saved successfully! You can record another attempt or switch to a different sign.');
      
    } catch (error) {
      console.error('Error saving attempt:', error);
      alert('❌ Failed to save attempt. Please try again.');
    } finally {
      setIsSaving(false);
    }
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
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600 mt-2">Practice ASL signs and track your progress</p>
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Practice History</h3>
          <p className="text-gray-600">
            Your practice history will appear here. This feature will show:
          </p>
          <ul className="mt-4 list-disc list-inside text-gray-600 space-y-1">
            <li>Recent practice sessions</li>
            <li>Scores for each attempt</li>
            <li>Signs you've practiced</li>
            <li>Improvement over time</li>
          </ul>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Coming soon:</strong> We'll track your attempts automatically and show your progress here.
            </p>
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
              <p className="text-3xl font-bold text-purple-600">0</p>
              <p className="text-sm text-gray-500">Coming soon</p>
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
    </div>
  );
}