import type { HandLandmarkFrame } from '../types/landmarks';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface LandmarkWeights {
  // Weights for different hand regions
  wrist: number;      // Landmark 0
  thumb: number[];    // Landmarks 1-4
  indexFinger: number[];  // Landmarks 5-8
  middleFinger: number[]; // Landmarks 9-12
  ringFinger: number[];   // Landmarks 13-16
  pinky: number[];    // Landmarks 17-20
}

const DEFAULT_WEIGHTS: LandmarkWeights = {
  wrist: 1.0,
  thumb: [1.0, 1.0, 1.0, 1.0],
  indexFinger: [1.0, 1.0, 1.0, 1.0],
  middleFinger: [1.0, 1.0, 1.0, 1.0],
  ringFinger: [1.0, 1.0, 1.0, 1.0],
  pinky: [1.0, 1.0, 1.0, 1.0]
};

interface DTWResult {
  distance: number;
  path: Array<[number, number]>;
  normalizedDistance: number;
}

/**
 * Calculate Euclidean distance between two 3D points
 */
function euclideanDistance(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate frame-to-frame distance considering all landmarks
 */
function getWeightForLandmark(index: number, weights: LandmarkWeights = DEFAULT_WEIGHTS): number {
  if (index === 0) return weights.wrist;
  if (index >= 1 && index <= 4) return weights.thumb[index - 1];
  if (index >= 5 && index <= 8) return weights.indexFinger[index - 5];
  if (index >= 9 && index <= 12) return weights.middleFinger[index - 9];
  if (index >= 13 && index <= 16) return weights.ringFinger[index - 13];
  if (index >= 17 && index <= 20) return weights.pinky[index - 17];
  return 1.0; // Default weight
}

function frameDistance(
  frame1: HandLandmarkFrame,
  frame2: HandLandmarkFrame,
  weights: LandmarkWeights = DEFAULT_WEIGHTS
): number {
  let weightedTotalDistance = 0;
  let totalWeight = 0;
  const landmarks1 = frame1.landmarks[0] || []; // Using first hand's landmarks
  const landmarks2 = frame2.landmarks[0] || [];

  // If either frame is missing landmarks, return maximum distance
  if (landmarks1.length === 0 || landmarks2.length === 0) {
    return Number.MAX_VALUE;
  }

  // Calculate weighted average distance across all landmarks
  for (let i = 0; i < landmarks1.length; i++) {
    const weight = getWeightForLandmark(i, weights);
    weightedTotalDistance += weight * euclideanDistance(landmarks1[i], landmarks2[i]);
    totalWeight += weight;
  }

  return weightedTotalDistance / totalWeight;
}

/**
 * Compute DTW distance between two sequences of landmarks
 */
export interface DTWOptions {
  weights?: LandmarkWeights;
  windowSize?: number; // Window size as percentage of sequence length (0-1)
}

export function computeDTW(
  sequence1: HandLandmarkFrame[] = [],
  sequence2: HandLandmarkFrame[] = [],
  options: DTWOptions = {}
): DTWResult {
  const n = sequence1.length;
  const m = sequence2.length;
  const { weights = DEFAULT_WEIGHTS, windowSize = 0.1 } = options;

  // Calculate window size in frames
  const w = Math.max(Math.floor(Math.max(n, m) * windowSize), 1);

  if (n === 0 || m === 0) {
    return { distance: Number.POSITIVE_INFINITY, path: [], normalizedDistance: Number.POSITIVE_INFINITY };
  }

  // Initialize DTW matrix with infinity
  const dtw: number[][] = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill(Number.POSITIVE_INFINITY));
  dtw[0][0] = 0;

  // Initialize traceback matrix
  const traceback: Array<Array<[number, number]>> = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill([0, 0]));

  // Fill DTW matrix with Sakoe-Chiba band constraint
  for (let i = 1; i <= n; i++) {
    // Calculate window bounds
    const jStart = Math.max(1, Math.floor(i * m / n - w));
    const jEnd = Math.min(m, Math.ceil(i * m / n + w));

    for (let j = jStart; j <= jEnd; j++) {
      const cost = frameDistance(sequence1[i - 1], sequence2[j - 1], weights);
      const min = Math.min(
        dtw[i - 1][j],     // insertion
        dtw[i][j - 1],     // deletion
        dtw[i - 1][j - 1]  // match
      );
      dtw[i][j] = cost + min;

      // Store traceback pointer
      if (min === dtw[i - 1][j - 1]) {
        traceback[i][j] = [i - 1, j - 1];
      } else if (min === dtw[i - 1][j]) {
        traceback[i][j] = [i - 1, j];
      } else {
        traceback[i][j] = [i, j - 1];
      }
    }
  }

  // Reconstruct the warping path
  const path: Array<[number, number]> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    path.unshift([i - 1, j - 1]);
    [i, j] = traceback[i][j];
  }

  // Calculate normalized distance
  const normalizedDistance = dtw[n][m] / (n + m);

  return {
    distance: dtw[n][m],
    path,
    normalizedDistance
  };
}

/**
 * Compare two sequences of hand landmarks and return a similarity score
 * Returns a score between 0 (completely different) and 100 (identical)
 */
export interface ComparisonOptions extends DTWOptions {
  handshapeWeight?: number; // Weight for handshape score (default: 0.4)
  movementWeight?: number;  // Weight for movement score (default: 0.4)
  timingWeight?: number;    // Weight for timing score (default: 0.2)
}

const DEFAULT_COMPARISON_WEIGHTS = {
  handshapeWeight: 0.4,
  movementWeight: 0.4,
  timingWeight: 0.2
};

export function compareLandmarkSequences(
  sequence1: HandLandmarkFrame[],
  sequence2: HandLandmarkFrame[],
  options: ComparisonOptions = {}
): number {
  const {
    handshapeWeight = DEFAULT_COMPARISON_WEIGHTS.handshapeWeight,
    movementWeight = DEFAULT_COMPARISON_WEIGHTS.movementWeight,
    timingWeight = DEFAULT_COMPARISON_WEIGHTS.timingWeight,
    ...dtwOptions
  } = options;

  // Get detailed scores
  const { handshapeScore, locationScore, movementScore } = calculateDetailedScores(
    sequence1,
    sequence2,
    dtwOptions
  );

  // Calculate weighted final score
  const finalScore = 
    handshapeWeight * handshapeScore +
    movementWeight * ((locationScore + movementScore) / 2) +
    timingWeight * (100 - Math.abs(sequence1.length - sequence2.length) / Math.max(sequence1.length, sequence2.length) * 100);

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, finalScore));
}

/**
 * Generate a heatmap showing the differences between two sequences
 * Returns an array of differences for each frame in the warping path
 */
export function generateHeatmap(
  sequence1: HandLandmarkFrame[],
  sequence2: HandLandmarkFrame[]
): Array<{ frameIndex: number, differences: number[] }> {
  if (!sequence1 || !sequence2 || sequence1.length === 0 || sequence2.length === 0) {
    return [];
  }

  const { path } = computeDTW(sequence1, sequence2);
  
  if (!path || path.length === 0) {
    return [];
  }
  
  return path.map(([i, j]) => {
    // Check bounds first
    if (i >= sequence1.length || j >= sequence2.length || i < 0 || j < 0) {
      return {
        frameIndex: i,
        differences: Array(21).fill(Number.MAX_VALUE)
      };
    }
    
    const frame1 = sequence1[i];
    const frame2 = sequence2[j];
    
    // If either frame doesn't exist or doesn't have landmarks, return maximum differences
    if (!frame1 || !frame2 || !frame1.landmarks || !frame2.landmarks || 
        !frame1.landmarks[0] || !frame2.landmarks[0]) {
      return {
        frameIndex: i,
        differences: Array(21).fill(Number.MAX_VALUE)
      };
    }
    
    const landmarks1 = frame1.landmarks[0] || [];
    const landmarks2 = frame2.landmarks[0] || [];
    
    // If either frame is missing landmarks, return maximum differences
    if (landmarks1.length === 0 || landmarks2.length === 0) {
      return {
        frameIndex: i,
        differences: Array(21).fill(Number.MAX_VALUE)
      };
    }
    
    // Calculate differences for each landmark
    const differences = landmarks1.map((landmark1, index) => {
      const landmark2 = landmarks2[index];
      return euclideanDistance(landmark1, landmark2);
    });

    return {
      frameIndex: i,
      differences
    };
  });
}

/**
 * Calculate specific scores for handshape, location, and movement
 */
export function calculateDetailedScores(
  sequence1: HandLandmarkFrame[],
  sequence2: HandLandmarkFrame[],
  options: DTWOptions = {}
): {
  handshapeScore: number;
  locationScore: number;
  movementScore: number;
} {
  // Validate input sequences
  if (!sequence1 || !sequence2 || sequence1.length === 0 || sequence2.length === 0) {
    return {
      handshapeScore: 0,
      locationScore: 0,
      movementScore: 0
    };
  }

  // Compute a base DTW path for alignment
  const { path: basePath } = computeDTW(sequence1, sequence2, options);

  if (!basePath || basePath.length === 0) {
    return {
      handshapeScore: 0,
      locationScore: 0,
      movementScore: 0
    };
  }
  
  let totalHandshapeDistance = 0;
  let totalLocationDistance = 0;
  let totalMovementDistance = 0;
  
  basePath.forEach(([i, j], index) => {
    const frame1 = sequence1[i];
    const frame2 = sequence2[j];
    
    // Skip if frames don't exist or don't have landmarks
    if (!frame1 || !frame2 || !frame1.landmarks || !frame2.landmarks || 
        !frame1.landmarks[0] || !frame2.landmarks[0]) {
      return;
    }
    
    const landmarks1 = frame1.landmarks[0] || [];
    const landmarks2 = frame2.landmarks[0] || [];
    
    // Skip if no landmarks
    if (landmarks1.length === 0 || landmarks2.length === 0) return;

    // Calculate handshape score using finger landmarks (indices 1-20)
    const handshapeDistance = landmarks1
      .slice(1, 21)
      .reduce((sum, landmark1, idx) => {
        const landmark2 = landmarks2[idx + 1];
        return sum + euclideanDistance(landmark1, landmark2);
      }, 0) / 20;

    // Calculate location score using wrist and palm landmarks (indices 0, 5, 9, 13, 17)
    const palmIndices = [0, 5, 9, 13, 17];
    const locationDistance = palmIndices
      .reduce((sum, idx) => {
        return sum + euclideanDistance(landmarks1[idx], landmarks2[idx]);
      }, 0) / palmIndices.length;

    // Calculate movement score using velocity differences
    if (index > 0 && basePath[index - 1]) {
      const [prevI, prevJ] = basePath[index - 1];
      const prevFrame1 = sequence1[prevI];
      const prevFrame2 = sequence2[prevJ];
      
      // Check if previous frames and their landmarks exist
      if (prevFrame1?.landmarks?.[0]?.length > 0 && 
          prevFrame2?.landmarks?.[0]?.length > 0 && 
          landmarks1.length > 0 && landmarks2.length > 0 &&
          landmarks1[0] && landmarks2[0] && 
          prevFrame1.landmarks[0][0] && prevFrame2.landmarks[0][0]) {
        
        const velocity1 = {
          x: landmarks1[0].x - prevFrame1.landmarks[0][0].x,
          y: landmarks1[0].y - prevFrame1.landmarks[0][0].y,
          z: landmarks1[0].z - prevFrame1.landmarks[0][0].z
        };
        
        const velocity2 = {
          x: landmarks2[0].x - prevFrame2.landmarks[0][0].x,
          y: landmarks2[0].y - prevFrame2.landmarks[0][0].y,
          z: landmarks2[0].z - prevFrame2.landmarks[0][0].z
        };
        
        totalMovementDistance += euclideanDistance(velocity1, velocity2);
      }
    }

    totalHandshapeDistance += handshapeDistance;
    totalLocationDistance += locationDistance;
  });

  // Convert distances to scores (0-100)
  const handshapeScore = 100 * Math.exp(-totalHandshapeDistance / basePath.length);
  const locationScore = 100 * Math.exp(-totalLocationDistance / basePath.length);
  const movementDenominator = Math.max(1, basePath.length - 1);
  const movementScore = 100 * Math.exp(-totalMovementDistance / movementDenominator);

  return {
    handshapeScore: Math.max(0, Math.min(100, handshapeScore)),
    locationScore: Math.max(0, Math.min(100, locationScore)),
    movementScore: Math.max(0, Math.min(100, movementScore))
  };
}
