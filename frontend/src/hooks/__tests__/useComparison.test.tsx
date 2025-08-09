import { renderHook, act } from '@testing-library/react-hooks';
import { useComparison } from '../useComparison';
import type { HandLandmarkFrame } from '../../types/landmarks';

describe('useComparison Hook', () => {
  // Helper function to create mock landmarks
  const createMockLandmark = (x: number, y: number, z: number) => ({ x, y, z });
  
  const createMockFrame = (x: number, y: number, z: number, timestamp = 0): HandLandmarkFrame => ({
    landmarks: [[
      createMockLandmark(x, y, z),
      ...Array(20).fill(createMockLandmark(x, y, z))
    ]],
    timestamp
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useComparison());

    expect(result.current.isComparing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.scores).toBeNull();
    expect(result.current.heatmap).toBeNull();
    expect(result.current.alignedPath).toBeNull();
  });

  it('should handle comparison of sequences', async () => {
    const { result } = renderHook(() => useComparison());

    const sequence1 = [
      createMockFrame(0, 0, 0, 0),
      createMockFrame(1, 1, 1, 100)
    ];

    const sequence2 = [
      createMockFrame(0.1, 0.1, 0.1, 0),
      createMockFrame(0.9, 0.9, 0.9, 100)
    ];

    await act(async () => {
      await result.current.compareSequences(sequence1, sequence2);
    });

    expect(result.current.isComparing).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(result.current.scores).toBeDefined();
    expect(result.current.heatmap).toBeDefined();
    expect(result.current.alignedPath).toBeDefined();

    if (result.current.scores) {
      expect(result.current.scores.overall).toBeGreaterThanOrEqual(0);
      expect(result.current.scores.overall).toBeLessThanOrEqual(100);
    }
  });

  it('should handle reset', () => {
    const { result } = renderHook(() => useComparison());

    act(() => {
      result.current.reset();
    });

    expect(result.current.isComparing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.scores).toBeNull();
    expect(result.current.heatmap).toBeNull();
    expect(result.current.alignedPath).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useComparison());

    const invalidSequence = [{}] as HandLandmarkFrame[];

    await act(async () => {
      try {
        await result.current.compareSequences(invalidSequence, invalidSequence);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.isComparing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.scores).toBeNull();
    expect(result.current.heatmap).toBeNull();
    expect(result.current.alignedPath).toBeNull();
  });
});
