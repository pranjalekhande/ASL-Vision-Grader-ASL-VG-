import type { HandLandmarkFrame } from '../types/landmarks';
import { calculateDetailedScores, computeDTW } from './dtw';
import type { DTWOptions } from './dtw';

export interface ScoringWeights {
  handshape: number;  // Weight for handshape score (default: 0.4)
  location: number;   // Weight for location score (default: 0.3)
  movement: number;   // Weight for movement score (default: 0.3)
}

export interface DetailedScore {
  total: number;
  handshape: number;
  location: number;
  movement: number;
  timing: number;
  confidence: number;
  feedback: string[];
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  handshape: 0.4,
  location: 0.3,
  movement: 0.3
};

/**
 * Calculate confidence score based on landmark confidence values
 */
function calculateConfidence(frames: HandLandmarkFrame[]): number {
  let totalConfidence = 0;
  let landmarkCount = 0;

  frames.forEach(frame => {
    frame.landmarks[0]?.forEach(landmark => {
      if (landmark.confidence !== undefined) {
        totalConfidence += landmark.confidence;
        landmarkCount++;
      }
    });
  });

  return landmarkCount > 0 ? (totalConfidence / landmarkCount) * 100 : 0;
}

/**
 * Calculate timing score based on sequence length difference and DTW path
 */
function calculateTimingScore(
  referenceFrames: HandLandmarkFrame[],
  studentFrames: HandLandmarkFrame[],
  dtwPath: Array<[number, number]>
): number {
  // Calculate length difference penalty
  const lengthDiff = Math.abs(referenceFrames.length - studentFrames.length);
  const lengthPenalty = Math.exp(-lengthDiff / Math.max(referenceFrames.length, studentFrames.length));

  // Calculate timing consistency using DTW path
  let consistencyScore = 0;
  for (let i = 1; i < dtwPath.length; i++) {
    const [prevRef, prevStudent] = dtwPath[i - 1];
    const [currRef, currStudent] = dtwPath[i];
    
    // Perfect timing would have diagonal moves (1,1)
    const idealMove = Math.min(currRef - prevRef, currStudent - prevStudent);
    const actualMove = Math.max(currRef - prevRef, currStudent - prevStudent);
    consistencyScore += idealMove / actualMove;
  }
  
  const avgConsistency = consistencyScore / (dtwPath.length - 1);
  
  // Combine length penalty and consistency
  return (lengthPenalty * 0.4 + avgConsistency * 0.6) * 100;
}

/**
 * Generate feedback based on scores and thresholds
 */
function generateFeedback(
  scores: Omit<DetailedScore, 'feedback'>,
  commonMistakes?: {
    handshape: string[];
    movement: string[];
    location: string[];
  }
): string[] {
  const feedback: string[] = [];
  const THRESHOLD = 70; // Score threshold for feedback

  // Add confidence-based feedback
  if (scores.confidence < 80) {
    feedback.push(
      'Try to keep your hands more visible to the camera throughout the sign.'
    );
  }

  // Add timing-based feedback
  if (scores.timing < THRESHOLD) {
    feedback.push(
      'Pay attention to the speed and rhythm of the sign. Try to match the reference timing.'
    );
  }

  // Add aspect-specific feedback
  if (scores.handshape < THRESHOLD && commonMistakes?.handshape) {
    feedback.push(...commonMistakes.handshape);
  }
  if (scores.location < THRESHOLD && commonMistakes?.location) {
    feedback.push(...commonMistakes.location);
  }
  if (scores.movement < THRESHOLD && commonMistakes?.movement) {
    feedback.push(...commonMistakes.movement);
  }

  // Add general feedback based on total score
  if (scores.total >= 90) {
    feedback.push('Excellent execution! Keep practicing to maintain this level.');
  } else if (scores.total >= 70) {
    feedback.push('Good attempt! Focus on the specific feedback to improve further.');
  } else {
    feedback.push('Keep practicing! Watch the reference video carefully and try again.');
  }

  return feedback;
}

/**
 * Calculate comprehensive score with detailed breakdown
 */
export function calculateComprehensiveScore(
  referenceFrames: HandLandmarkFrame[],
  studentFrames: HandLandmarkFrame[],
  options: {
    weights?: ScoringWeights;
    dtwOptions?: DTWOptions;
    commonMistakes?: {
      handshape: string[];
      movement: string[];
      location: string[];
    };
  } = {}
): DetailedScore {
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  
  // Calculate DTW-based scores
  const { handshapeScore, locationScore, movementScore } = calculateDetailedScores(
    referenceFrames,
    studentFrames,
    options.dtwOptions
  );

  // Calculate timing score
  const { path } = computeDTW(referenceFrames, studentFrames, options.dtwOptions);
  const timingScore = calculateTimingScore(referenceFrames, studentFrames, path);

  // Calculate confidence score
  const confidenceScore = calculateConfidence(studentFrames);

  // Calculate total score
  const totalScore = Math.round(
    handshapeScore * weights.handshape +
    locationScore * weights.location +
    movementScore * weights.movement
  );

  const scores = {
    total: totalScore,
    handshape: Math.round(handshapeScore),
    location: Math.round(locationScore),
    movement: Math.round(movementScore),
    timing: Math.round(timingScore),
    confidence: Math.round(confidenceScore)
  };

  // Generate feedback
  const feedback = generateFeedback(scores, options.commonMistakes);

  return {
    ...scores,
    feedback
  };
}

