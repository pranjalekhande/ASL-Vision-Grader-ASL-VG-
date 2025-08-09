import { useState, useCallback, useMemo } from 'react';
import type { HandLandmarkFrame } from '../types/landmarks';
import { computeDTW, calculateDetailedScores, generateHeatmap } from '../utils/dtw';

export interface ComparisonState {
  isComparing: boolean;
  progress: number;
  scores: {
    overall: number;
    handshape: number;
    location: number;
    movement: number;
  } | null;
  heatmap: Array<{ frameIndex: number; differences: number[] }> | null;
  alignedPath: Array<[number, number]> | null;
}

export interface ComparisonResult {
  scores: {
    overall: number;
    handshape: number;
    location: number;
    movement: number;
  };
  heatmap: Array<{ frameIndex: number; differences: number[] }>;
  alignedPath: Array<[number, number]>;
}

export function useComparison() {
  const [state, setState] = useState<ComparisonState>({
    isComparing: false,
    progress: 0,
    scores: null,
    heatmap: null,
    alignedPath: null
  });

  const compareSequences = useCallback(
    async (
      attemptSequence: HandLandmarkFrame[],
      referenceSequence: HandLandmarkFrame[]
    ): Promise<ComparisonResult> => {
      try {
        setState(prev => ({ ...prev, isComparing: true, progress: 0 }));

        // Compute DTW and get aligned path
        const { path, normalizedDistance } = computeDTW(attemptSequence, referenceSequence);
        setState(prev => ({ ...prev, progress: 33 }));

        // Calculate detailed scores
        const { handshapeScore, locationScore, movementScore } = calculateDetailedScores(
          attemptSequence,
          referenceSequence
        );
        setState(prev => ({ ...prev, progress: 66 }));

        // Generate heatmap
        const heatmapData = generateHeatmap(attemptSequence, referenceSequence);
        
        // Calculate overall score as weighted average
        const overall = Math.round(
          (handshapeScore * 0.4 + locationScore * 0.3 + movementScore * 0.3)
        );

        const result = {
          scores: {
            overall,
            handshape: Math.round(handshapeScore),
            location: Math.round(locationScore),
            movement: Math.round(movementScore)
          },
          heatmap: heatmapData,
          alignedPath: path
        };

        setState(prev => ({
          ...prev,
          isComparing: false,
          progress: 100,
          scores: result.scores,
          heatmap: result.heatmap,
          alignedPath: result.alignedPath
        }));

        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          isComparing: false,
          progress: 0,
          scores: null,
          heatmap: null,
          alignedPath: null
        }));
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      isComparing: false,
      progress: 0,
      scores: null,
      heatmap: null,
      alignedPath: null
    });
  }, []);

  // Memoize the current state to prevent unnecessary re-renders
  const currentState = useMemo(
    () => ({
      isComparing: state.isComparing,
      progress: state.progress,
      scores: state.scores,
      heatmap: state.heatmap,
      alignedPath: state.alignedPath
    }),
    [state]
  );

  return {
    ...currentState,
    compareSequences,
    reset
  };
}


