import React, { useState } from 'react';
import { supabase } from '../../config/supabase';

export const CreateTestVideo: React.FC = () => {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const createTestAttempt = async () => {
    setCreating(true);
    setResult(null);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get any sign ID
      const { data: signs } = await supabase
        .from('signs')
        .select('id')
        .limit(1);
      
      if (!signs || signs.length === 0) {
        throw new Error('No signs found in database');
      }

      // Create a simple test video blob (just a tiny video file)
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d')!;
      
      // Draw a simple test pattern
      ctx.fillStyle = '#0066cc';
      ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = 'white';
      ctx.font = '20px Arial';
      ctx.fillText('Test Video', 100, 120);

      // Create a video blob (this is a simplified approach)
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
      
      // Record for 1 second
      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
      }, 1000);

      const videoBlob = await recordingPromise;

      // Create test landmark data
      const landmarkData = {
        frames: [
          {
            landmarks: [[{ x: 0.5, y: 0.5, z: 0, visibility: 1 }]],
            timestamp: 0
          }
        ],
        metadata: {
          fps: 30,
          totalFrames: 30,
          duration: 1000
        }
      };

      // Create attempt record
      const { data: attempt, error: attemptError } = await supabase
        .from('attempts')
        .insert({
          student_id: user.id,
          sign_id: signs[0].id,
          landmarks: landmarkData,
          score_shape: 85,
          score_location: 90,
          score_movement: 80,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Upload video
      const videoPath = `attempts/video/${attempt.id}`;
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(videoPath, videoBlob);

      if (uploadError) throw uploadError;

      // Get video URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(videoPath);

      // Update attempt with video URL
      const { error: updateError } = await supabase
        .from('attempts')
        .update({ video_url: publicUrl })
        .eq('id', attempt.id);

      if (updateError) throw updateError;

      setResult(`✅ Test attempt created successfully! 
      
Attempt ID: ${attempt.id}
Video URL: ${publicUrl}

This attempt should now show up in the Recent Attempts list with a working video!`);

    } catch (error) {
      setResult(`❌ Failed to create test attempt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-4">
      <h3 className="text-lg font-semibold text-blue-900 mb-4">Create Test Video Attempt</h3>
      
      <p className="text-blue-800 mb-4">
        This will create a test student attempt with a working video. 
        Use this to test the video review functionality.
      </p>

      <button
        onClick={createTestAttempt}
        disabled={creating}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {creating ? 'Creating Test Video...' : 'Create Test Video Attempt'}
      </button>

      {result && (
        <div className="mt-4 p-4 bg-white rounded border">
          <pre className="text-sm whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  );
};
