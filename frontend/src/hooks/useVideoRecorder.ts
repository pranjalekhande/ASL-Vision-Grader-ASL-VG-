import { useState, useRef, useCallback, useEffect } from 'react';
import type { VideoConstraints } from '../types/video';

const DEFAULT_CONSTRAINTS: VideoConstraints = {
  width: 1280,
  height: 720,
  frameRate: 30,
};

export const useVideoRecorder = (maxDuration: number = 7) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Initialize camera stream immediately
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: DEFAULT_CONSTRAINTS,
          audio: false,
        });
        console.log('Camera initialized successfully');
        setStream(mediaStream);
      } catch (err) {
        console.error('Camera initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to access camera');
      }
    };

    initializeCamera();

    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!stream) {
      console.error('No stream available');
      setError('Camera stream not available');
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log('Recording started');

      // Stop recording after maxDuration
      timerRef.current = window.setTimeout(() => {
        stopRecording();
      }, maxDuration * 1000);
    } catch (err) {
      console.error('Recording start error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [maxDuration, stream]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        chunksRef.current = []; // Clear chunks after creating blob
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('Recording stopped');
    }
  }, [isRecording]);

  const getRecordedBlob = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      if (chunksRef.current.length === 0) {
        resolve(new Blob([], { type: 'video/webm' }));
        return;
      }
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      resolve(blob);
    });
  }, []);

  // Clear recorded blob when starting new recording
  useEffect(() => {
    if (isRecording) {
      setRecordedBlob(null);
    }
  }, [isRecording]);

  return {
    isRecording,
    error,
    stream,
    recordedBlob,
    startRecording,
    stopRecording,
  };
};