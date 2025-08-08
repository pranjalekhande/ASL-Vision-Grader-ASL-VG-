import { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { initializeMediaPipe } from '../utils/mediapipe';

export const useMediaPipe = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handDetectorRef = useRef<HandLandmarker | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        const detector = await initializeMediaPipe();
        handDetectorRef.current = detector;
        setIsInitialized(true);
      } catch (err) {
        console.error('MediaPipe initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize MediaPipe');
      }
    };

    init();

    return () => {
      if (handDetectorRef.current) {
        handDetectorRef.current.close();
      }
    };
  }, []);

  const detectLandmarks = useCallback(async (video: HTMLVideoElement, timestamp: number): Promise<HandLandmarkerResult | null> => {
    if (!handDetectorRef.current || processingRef.current) {
      return null;
    }

    // Check video dimensions and readiness
    if (!video || video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
      return null;
    }

    try {
      processingRef.current = true;
      const results = handDetectorRef.current.detectForVideo(video, timestamp);
      return results;
    } catch (err) {
      console.error('Landmark detection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to detect landmarks');
      return null;
    } finally {
      processingRef.current = false;
    }
  }, []);

  return {
    isInitialized,
    error,
    detectLandmarks,
  };
};