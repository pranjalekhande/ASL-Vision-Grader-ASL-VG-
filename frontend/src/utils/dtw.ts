import type { HandLandmarkFrame } from '../types/landmarks';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

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
function frameDistance(frame1: HandLandmarkFrame, frame2: HandLandmarkFrame): number {
  let totalDistance = 0;
  const landmarks1 = frame1.landmarks[0] || []; // Using first hand's landmarks
  const landmarks2 = frame2.landmarks[0] || [];

  // If either frame is missing landmarks, return maximum distance
  if (landmarks1.length === 0 || landmarks2.length === 0) {
    return Number.MAX_VALUE;
  }

  // Calculate average distance across all landmarks
  for (let i = 0; i < landmarks1.length; i++) {
    totalDistance += euclideanDistance(landmarks1[i], landmarks2[i]);
  }

  return totalDistance / landmarks1.length;
}

/**
 * Compute DTW distance between two sequences of landmarks
 */
export function computeDTW(
  sequence1: HandLandmarkFrame[],
  sequence2: HandLandmarkFrame[]
): DTWResult {
  const n = sequence1.length;
  const m = sequence2.length;

  // Initialize DTW matrix with infinity
  const dtw: number[][] = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill(Number.POSITIVE_INFINITY));
  dtw[0][0] = 0;

  // Initialize traceback matrix
  const traceback: Array<Array<[number, number]>> = Array(n + 1)
    .fill(null)
    .map(() => Array(m + 1).fill([0, 0]));

  // Fill DTW matrix
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = frameDistance(sequence1[i - 1], sequence2[j - 1]);
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
export function compareLandmarkSequences(
  sequence1: HandLandmarkFrame[],
  sequence2: HandLandmarkFrame[]
): number {
  const { normalizedDistance } = computeDTW(sequence1, sequence2);
  
  // Convert distance to a similarity score (0-100)
  // Using an exponential decay function to map distance to score
  const score = 100 * Math.exp(-normalizedDistance);
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate a heatmap showing the differences between two sequences
 * Returns an array of differences for each frame in the warping path
 */
export function generateHeatmap(
  sequence1: HandLandmarkFrame[],
  sequence2: HandLandmarkFrame[]
): Array<{ frameIndex: number, differences: number[] }> {
  const { path } = computeDTW(sequence1, sequence2);
  
  return path.map(([i, j]) => {
    const frame1 = sequence1[i];
    const frame2 = sequence2[j];
    const landmarks1 = frame1.landmarks[0] || [];
    const landmarks2 = frame2.landmarks[0] || [];
    
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
  sequence2: HandLandmarkFrame[]
): {
  handshapeScore: number;
  locationScore: number;
  movementScore: number;
} {
  const { path } = computeDTW(sequence1, sequence2);
  
  let totalHandshapeDistance = 0;
  let totalLocationDistance = 0;
  let totalMovementDistance = 0;
  
  path.forEach(([i, j], index) => {
    const frame1 = sequence1[i];
    const frame2 = sequence2[j];
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
    if (index > 0) {
      const [prevI, prevJ] = path[index - 1];
      const prevFrame1 = sequence1[prevI];
      const prevFrame2 = sequence2[prevJ];
      
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

    totalHandshapeDistance += handshapeDistance;
    totalLocationDistance += locationDistance;
  });

  // Convert distances to scores (0-100)
  const handshapeScore = 100 * Math.exp(-totalHandshapeDistance / path.length);
  const locationScore = 100 * Math.exp(-totalLocationDistance / path.length);
  const movementScore = 100 * Math.exp(-totalMovementDistance / (path.length - 1));

  return {
    handshapeScore: Math.max(0, Math.min(100, handshapeScore)),
    locationScore: Math.max(0, Math.min(100, locationScore)),
    movementScore: Math.max(0, Math.min(100, movementScore))
  };
}
