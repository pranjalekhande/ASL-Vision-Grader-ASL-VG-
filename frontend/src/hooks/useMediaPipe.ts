import { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker } from '@mediapipe/tasks-vision';
import { type HandLandmarkerResult } from '../types/mediapipe';
import { initializeMediaPipe } from '../utils/mediapipe';

export const useMediaPipe = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        handLandmarkerRef.current = await initializeMediaPipe();
        setIsInitialized(true);
      } catch (err) {
        console.error('MediaPipe initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize MediaPipe');
      }
    };

    init();

    return () => {
      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close();
      }
    };
  }, []);

  const detectLandmarks = useCallback(async (
    video: HTMLVideoElement,
    timestamp: number
  ): Promise<HandLandmarkerResult | null> => {
    if (!handLandmarkerRef.current || !isInitialized || isProcessingRef.current) {
      return null;
    }

    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      return null;
    }

    try {
      isProcessingRef.current = true;

      const result = handLandmarkerRef.current.detectForVideo(video, timestamp);
      // Only return screen landmarks and handedness, skip worldLandmarks to avoid warnings
      return {
        landmarks: result.landmarks || [],
        handedness: result.handedness || []
      };
    } catch (err) {
      console.error('Landmark detection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to detect landmarks');
      return null;
    } finally {
      isProcessingRef.current = false;
    }
  }, [isInitialized]);

  return {
    isInitialized,
    error,
    detectLandmarks,
  };
};