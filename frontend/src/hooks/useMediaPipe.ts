import { useEffect, useRef, useState, useCallback } from 'react';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { mediaPipeService } from '../services/mediapipeService';

export const useMediaPipe = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      try {
        await mediaPipeService.acquire();
        setIsInitialized(true);
      } catch (err) {
        console.error('MediaPipe initialization error:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize MediaPipe');
      }
    };

    init();

    return () => {
      mediaPipeService.release();
    };
  }, []);

  const detectLandmarks = useCallback(async (video: HTMLVideoElement, timestamp: number): Promise<HandLandmarkerResult | null> => {
    if (!mediaPipeService.isReady || processingRef.current) {
      return null;
    }

    // Check video dimensions and readiness
    if (!video || video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
      return null;
    }

    try {
      processingRef.current = true;
      return await mediaPipeService.detect(video, timestamp);
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