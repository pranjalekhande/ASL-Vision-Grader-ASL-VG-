import { useState, useCallback } from 'react';
import type { HandLandmarkFrame, RecordingData } from '../types/landmarks';
import {
  compareLandmarkSequences,
  calculateDetailedScores,
  generateHeatmap
} from '../utils/dtw';

interface ComparisonResult {
  overallScore: number;
  handshapeScore: number;
  locationScore: number;
  movementScore: number;
  heatmap: Array<{ frameIndex: number; differences: number[] }>;
}

export function useSignComparison() {
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compareSign = useCallback(
    async (
      recordedData: RecordingData,
      exemplarData: RecordingData
    ): Promise<ComparisonResult> => {
      try {
        setIsComparing(true);
        setError(null);

        // Extract frames from recordings
        const recordedFrames = recordedData.frames;
        const exemplarFrames = exemplarData.frames;

        // Calculate overall similarity score
        const overallScore = compareLandmarkSequences(recordedFrames, exemplarFrames);

        // Calculate detailed scores
        const { handshapeScore, locationScore, movementScore } = calculateDetailedScores(
          recordedFrames,
          exemplarFrames
        );

        // Generate heatmap data
        const heatmap = generateHeatmap(recordedFrames, exemplarFrames);

        return {
          overallScore,
          handshapeScore,
          locationScore,
          movementScore,
          heatmap
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to compare signs';
        setError(errorMessage);
        throw err;
      } finally {
        setIsComparing(false);
      }
    },
    []
  );

  return {
    compareSign,
    isComparing,
    error
  };
}
