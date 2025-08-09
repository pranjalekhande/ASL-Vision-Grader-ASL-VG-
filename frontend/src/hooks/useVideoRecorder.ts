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

  // Initialize camera stream
  const initializeStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: DEFAULT_CONSTRAINTS,
        audio: false
      });
      setStream(stream);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access camera');
      setStream(null);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(() => {
    if (!stream) {
      setError('No camera stream available');
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

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);

      // Set timer to stop recording after maxDuration
      timerRef.current = window.setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          setIsRecording(false);
        }
      }, maxDuration * 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [stream, maxDuration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // Initialize stream on mount
  useEffect(() => {
    initializeStream();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeStream]);

  return {
    isRecording,
    error,
    stream,
    recordedBlob,
    startRecording,
    stopRecording
  };
};