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
  const dataAvailablePromiseRef = useRef<Promise<void> | null>(null);
  const dataAvailableResolveRef = useRef<(() => void) | null>(null);

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
        stream.getTracks().forEach(track => {
          track.stop();
          stream.removeTrack(track);
        });
        setStream(null);
      }
      // Clean up any existing recorder
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
      }
      // Clear any pending timers
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Reset state
      setIsRecording(false);
      setError(null);
      chunksRef.current = [];
      dataAvailableResolveRef.current = null;
      dataAvailablePromiseRef.current = null;
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!stream) {
      console.error('No stream available');
      setError('Camera stream not available');
      return;
    }

    try {
      // Create a new promise that will resolve when we get the first data
      dataAvailablePromiseRef.current = new Promise((resolve) => {
        dataAvailableResolveRef.current = resolve;
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Received video chunk:', event.data.size, 'bytes');
          chunksRef.current.push(event.data);
          // Resolve the promise when we get the first chunk
          if (dataAvailableResolveRef.current) {
            dataAvailableResolveRef.current();
            dataAvailableResolveRef.current = null;
          }
        }
      };

      // Request data every 100ms to ensure smooth recording
      mediaRecorder.start(100);
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

  const stopRecording = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      try {
        // Wait for at least one chunk of data before stopping
        if (dataAvailablePromiseRef.current) {
          await dataAvailablePromiseRef.current;
        }

        // Create a promise that resolves when the recorder stops
        const stopPromise = new Promise<void>((resolve) => {
          if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = () => {
              const blob = new Blob(chunksRef.current, { 
                type: 'video/webm'
              });
              console.log('Recording completed, blob size:', blob.size);
              setRecordedBlob(blob);
              chunksRef.current = []; // Clear chunks after creating blob
              resolve();
            };
          }
        });

        mediaRecorderRef.current.stop();
        setIsRecording(false);
        console.log('Recording stopped');

        // Wait for the stop event to complete
        await stopPromise;
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('Failed to stop recording properly');
      }
    }
  }, [isRecording]);

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