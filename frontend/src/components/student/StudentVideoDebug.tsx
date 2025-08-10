import React, { useState } from 'react';
import { supabase } from '../../config/supabase';
import { SupabaseService } from '../../services/supabase';

export const StudentVideoDebug: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const testStudentUpload = async () => {
    setTesting(true);
    setResult(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get any sign ID
      const { data: signs } = await supabase
        .from('signs')
        .select('id, name')
        .limit(1);
      
      if (!signs || signs.length === 0) {
        throw new Error('No signs found in database');
      }

      // Create a test video blob (mimicking student recording)
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      
      // Draw a test pattern
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = 'white';
      ctx.font = '24px Arial';
      ctx.fillText('Student Test Video', 200, 240);

      // Create video blob
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      
      const recordingPromise = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          resolve(blob);
        };
      });

      mediaRecorder.start();
      
      // Record for 2 seconds
      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
      }, 2000);

      const videoBlob = await recordingPromise;

      // Create test landmark data (mimicking MediaPipe output)
      const landmarkData = {
        frames: [
          {
            landmarks: [[
              { x: 0.5, y: 0.4, z: 0, visibility: 1 },
              { x: 0.52, y: 0.42, z: 0.1, visibility: 1 },
              { x: 0.48, y: 0.38, z: -0.1, visibility: 1 }
            ]],
            timestamp: 0
          },
          {
            landmarks: [[
              { x: 0.51, y: 0.41, z: 0.05, visibility: 1 },
              { x: 0.53, y: 0.43, z: 0.12, visibility: 1 },
              { x: 0.49, y: 0.39, z: -0.08, visibility: 1 }
            ]],
            timestamp: 1000
          }
        ],
        metadata: {
          fps: 30,
          totalFrames: 60,
          duration: 2000
        }
      };

      // Test scores (mimicking DTW output)
      const scores = {
        score_shape: 88,
        score_location: 92,
        score_movement: 85,
        heatmap: { /* simplified heatmap */ }
      };

      console.log('Testing student upload with:', {
        signId: signs[0].id,
        videoSize: videoBlob.size,
        landmarkFrames: landmarkData.frames.length,
        scores
      });

      // Use the EXACT same method students use
      const attempt = await SupabaseService.uploadAttempt({
        signId: signs[0].id,
        videoBlob: videoBlob,
        landmarkData: landmarkData,
        scores: scores
      });

      console.log('Student upload result:', attempt);

      // Check if video URL was created
      const { data: attemptData } = await supabase
        .from('attempts')
        .select('id, video_url, landmarks, score_shape, score_location, score_movement')
        .eq('id', attempt.id)
        .single();

      setResult(`✅ Student upload test successful!

Attempt ID: ${attempt.id}
Sign: ${signs[0].name}
Video URL: ${attemptData?.video_url || 'NULL - This is the problem!'}
Landmark frames: ${attemptData?.landmarks?.frames?.length || 0}
Scores: Shape ${attemptData?.score_shape}%, Location ${attemptData?.score_location}%, Movement ${attemptData?.score_movement}%

${attemptData?.video_url ? 
  'This should now appear in teacher dashboard with working video!' : 
  '❌ VIDEO URL IS NULL - This explains why teacher sees "Video Not Available"'
}`);

    } catch (error) {
      setResult(`❌ Student upload test failed: ${error instanceof Error ? error.message : 'Unknown error'}

This explains why student videos don't appear in teacher dashboard.
Check console for detailed error.`);
      console.error('Student upload test error:', error);
    } finally {
      setTesting(false);
    }
  };

  const checkStoragePermissions = async () => {
    try {
      // Test if we can access storage
      const { data: files, error } = await supabase.storage
        .from('videos')
        .list('attempts/video', { limit: 5 });

      if (error) {
        setResult(`❌ Storage permission error: ${error.message}

This could be why student videos aren't uploading properly.`);
      } else {
        setResult(`✅ Storage access works!
Found ${files?.length || 0} video files in student attempts folder.

If this works but uploads fail, the issue is in the upload process itself.`);
      }
    } catch (error) {
      setResult(`❌ Storage check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mt-4">
      <h3 className="text-lg font-semibold text-orange-900 mb-4">Student Video Upload Debugging</h3>
      
      <p className="text-orange-800 mb-4">
        Let's test why student videos aren't appearing in teacher dashboard.
      </p>

      <div className="space-x-3 mb-4">
        <button
          onClick={testStudentUpload}
          disabled={testing}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          {testing ? 'Testing Student Upload...' : 'Test Student Upload Process'}
        </button>

        <button
          onClick={checkStoragePermissions}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Check Storage Permissions
        </button>
      </div>

      {result && (
        <div className="mt-4 p-4 bg-white rounded border">
          <pre className="text-sm whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  );
};
