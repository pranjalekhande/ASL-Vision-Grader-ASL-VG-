import { computeDTW, calculateDetailedScores, generateHeatmap } from '../dtw';
import type { HandLandmarkFrame } from '../../types/landmarks';

describe('DTW Algorithm', () => {
  // Helper function to create mock landmarks
  const createMockLandmark = (x: number, y: number, z: number) => ({ x, y, z });
  
  const createMockFrame = (landmarks: Array<{ x: number, y: number, z: number }>, timestamp = 0): HandLandmarkFrame => ({
    landmarks: [landmarks],
    timestamp
  });

  describe('computeDTW', () => {
    it('should handle identical sequences', () => {
      const sequence = [
        createMockFrame([createMockLandmark(0, 0, 0)]),
        createMockFrame([createMockLandmark(1, 1, 1)])
      ];

      const result = computeDTW(sequence, sequence);
      expect(result.distance).toBe(0);
      expect(result.normalizedDistance).toBe(0);
      expect(result.path).toHaveLength(2);
    });

    it('should handle sequences of different lengths', () => {
      const sequence1 = [
        createMockFrame([createMockLandmark(0, 0, 0)]),
        createMockFrame([createMockLandmark(1, 1, 1)])
      ];

      const sequence2 = [
        createMockFrame([createMockLandmark(0, 0, 0)]),
        createMockFrame([createMockLandmark(0.5, 0.5, 0.5)]),
        createMockFrame([createMockLandmark(1, 1, 1)])
      ];

      const result = computeDTW(sequence1, sequence2);
      expect(result.path).toHaveLength(3);
      expect(result.normalizedDistance).toBeGreaterThan(0);
    });

    it('should handle empty sequences', () => {
      const emptySequence: HandLandmarkFrame[] = [];
      const sequence = [createMockFrame([createMockLandmark(0, 0, 0)])];

      expect(() => computeDTW(emptySequence, sequence)).not.toThrow();
      expect(() => computeDTW(sequence, emptySequence)).not.toThrow();
    });
  });

  describe('calculateDetailedScores', () => {
    it('should calculate all score components', () => {
      const sequence1 = [
        createMockFrame([
          createMockLandmark(0, 0, 0),
          ...Array(20).fill(createMockLandmark(0, 0, 0))
        ], 0),
        createMockFrame([
          createMockLandmark(0.1, 0.1, 0.1),
          ...Array(20).fill(createMockLandmark(0.1, 0.1, 0.1))
        ], 100)
      ];

      const sequence2 = [
        createMockFrame([
          createMockLandmark(0.1, 0.1, 0.1),
          ...Array(20).fill(createMockLandmark(0.1, 0.1, 0.1))
        ], 0),
        createMockFrame([
          createMockLandmark(0.2, 0.2, 0.2),
          ...Array(20).fill(createMockLandmark(0.2, 0.2, 0.2))
        ], 100)
      ];

      const scores = calculateDetailedScores(sequence1, sequence2);
      
      expect(scores.handshapeScore).toBeDefined();
      expect(scores.locationScore).toBeDefined();
      expect(scores.movementScore).toBeDefined();
      
      expect(scores.handshapeScore).toBeGreaterThanOrEqual(0);
      expect(scores.handshapeScore).toBeLessThanOrEqual(100);
      expect(scores.locationScore).toBeGreaterThanOrEqual(0);
      expect(scores.locationScore).toBeLessThanOrEqual(100);
      expect(scores.movementScore).toBeGreaterThanOrEqual(0);
      expect(scores.movementScore).toBeLessThanOrEqual(100);
    });

    it('should handle perfect matches', () => {
      const sequence = [
        createMockFrame([
          createMockLandmark(0, 0, 0),
          ...Array(20).fill(createMockLandmark(0, 0, 0))
        ], 0),
        createMockFrame([
          createMockLandmark(0.1, 0.1, 0.1),
          ...Array(20).fill(createMockLandmark(0.1, 0.1, 0.1))
        ], 100)
      ];

      const scores = calculateDetailedScores(sequence, sequence);
      
      expect(scores.handshapeScore).toBe(100);
      expect(scores.locationScore).toBe(100);
      expect(scores.movementScore).toBe(100);
    });
  });

  describe('generateHeatmap', () => {
    it('should generate heatmap data for each frame', () => {
      const sequence1 = [
        createMockFrame([
          createMockLandmark(0, 0, 0),
          ...Array(20).fill(createMockLandmark(0, 0, 0))
        ], 0),
        createMockFrame([
          createMockLandmark(1, 1, 1),
          ...Array(20).fill(createMockLandmark(1, 1, 1))
        ], 100)
      ];

      const sequence2 = [
        createMockFrame([
          createMockLandmark(0.1, 0.1, 0.1),
          ...Array(20).fill(createMockLandmark(0.1, 0.1, 0.1))
        ], 0),
        createMockFrame([
          createMockLandmark(0.9, 0.9, 0.9),
          ...Array(20).fill(createMockLandmark(0.9, 0.9, 0.9))
        ], 100)
      ];

      const heatmap = generateHeatmap(sequence1, sequence2);
      
      expect(heatmap).toHaveLength(2);
      expect(heatmap[0].differences).toBeDefined();
      expect(heatmap[0].frameIndex).toBeDefined();
      expect(heatmap[0].differences).toHaveLength(21); // 21 landmarks per hand
    });

    it('should handle empty sequences', () => {
      const emptySequence: HandLandmarkFrame[] = [];
      const sequence = [
        createMockFrame([
          createMockLandmark(0, 0, 0),
          ...Array(20).fill(createMockLandmark(0, 0, 0))
        ])
      ];

      const emptyResult = generateHeatmap(emptySequence, sequence);
      expect(emptyResult).toEqual([]);
      
      const emptyResult2 = generateHeatmap(sequence, emptySequence);
      expect(emptyResult2).toEqual([]);
    });
  });
});
