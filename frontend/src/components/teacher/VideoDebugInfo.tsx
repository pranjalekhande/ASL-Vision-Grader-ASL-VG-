import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';

interface AttemptInfo {
  id: string;
  student_id: string;
  sign_id: string;
  video_url: string | null;
  created_at: string;
  has_landmarks: boolean;
}

export const VideoDebugInfo: React.FC = () => {
  const [attempts, setAttempts] = useState<AttemptInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttempts();
  }, []);

  const loadAttempts = async () => {
    try {
      const { data } = await supabase
        .from('attempts')
        .select('id, student_id, sign_id, video_url, created_at, landmarks')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        const formattedAttempts = data.map(attempt => ({
          id: attempt.id,
          student_id: attempt.student_id,
          sign_id: attempt.sign_id,
          video_url: attempt.video_url,
          created_at: attempt.created_at,
          has_landmarks: !!attempt.landmarks
        }));
        setAttempts(formattedAttempts);
      }
    } catch (error) {
      console.error('Error loading attempts:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkVideoStorage = async () => {
    try {
      const { data: files } = await supabase.storage
        .from('videos')
        .list('attempts/video');
      
      console.log('Video files in storage:', files);
    } catch (error) {
      console.error('Error checking video storage:', error);
    }
  };

  if (loading) return <div>Loading debug info...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Video Debug Information</h3>
        <button
          onClick={checkVideoStorage}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
        >
          Check Storage
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Attempt ID
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Video URL
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Has Landmarks
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {attempts.map((attempt) => (
              <tr key={attempt.id}>
                <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                  {attempt.id.substring(0, 8)}...
                </td>
                <td className="px-4 py-2 text-sm">
                  {attempt.video_url ? (
                    <div>
                      <span className="text-green-600">✓ Available</span>
                      <div className="text-xs text-gray-500 mt-1">
                        <a 
                          href={attempt.video_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Video
                        </a>
                      </div>
                    </div>
                  ) : (
                    <span className="text-red-600">✗ Missing</span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm">
                  {attempt.has_landmarks ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-red-600">✗</span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">
                  {new Date(attempt.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2 text-sm">
                  {attempt.video_url && (
                    <button
                      onClick={() => {
                        // Test if video actually loads
                        const video = document.createElement('video');
                        video.src = attempt.video_url!;
                        video.onloadedmetadata = () => {
                          console.log('Video loads successfully:', {
                            duration: video.duration,
                            width: video.videoWidth,
                            height: video.videoHeight
                          });
                        };
                        video.onerror = (e) => {
                          console.error('Video failed to load:', e);
                        };
                      }}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Test Load
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {attempts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No attempts found in database
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Summary:</strong></p>
        <ul className="list-disc list-inside mt-2">
          <li>Total attempts: {attempts.length}</li>
          <li>With videos: {attempts.filter(a => a.video_url).length}</li>
          <li>With landmarks: {attempts.filter(a => a.has_landmarks).length}</li>
        </ul>
      </div>
    </div>
  );
};
