import type { HandLandmarkFrame } from '../types/landmarks';
import type { ReferenceSign } from '../types/signs';

/**
 * Common signs to include in exemplar data
 */
const COMMON_SIGNS = [
  'Hello',
  'Thank you',
  'Please',
  'Name',
  'Good'
] as const;

interface SignMetadata {
  difficulty: number;
  description: string;
  common_mistakes: {
    handshape: string[];
    movement: string[];
    location: string[];
  };
}

/**
 * Base structure for a hand landmark
 * Coordinates are normalized (0-1)
 */
const SIGN_METADATA: Record<typeof COMMON_SIGNS[number], SignMetadata> = {
  'Hello': {
    difficulty: 1,
    description: 'Wave your open hand near your head, palm facing out',
    common_mistakes: {
      handshape: ['Fingers too close together', 'Palm facing wrong direction'],
      movement: ['Not waving', 'Waving too far from head'],
      location: ['Hand too low', 'Hand too far from face']
    }
  },
  'Thank you': {
    difficulty: 1,
    description: 'Touch your chin or lips with your fingertips, then move your hand forward and down',
    common_mistakes: {
      handshape: ['Fingers spread too wide', 'Using wrong hand orientation'],
      movement: ['Movement too abrupt', 'Not moving forward enough'],
      location: ['Starting too far from chin', 'Ending position too high']
    }
  },
  'Please': {
    difficulty: 2,
    description: 'Rub your open hand in a circular motion on your chest',
    common_mistakes: {
      handshape: ['Hand too tense', 'Fingers not flat enough'],
      movement: ['Circle too small', 'Not enough rotations'],
      location: ['Hand too high/low on chest', 'Movement not centered']
    }
  },
  'Name': {
    difficulty: 2,
    description: 'Index and middle fingers extended, tap them together twice',
    common_mistakes: {
      handshape: ['Wrong fingers extended', 'Fingers too far apart'],
      movement: ['Not tapping fingers', 'Tapping too hard/soft'],
      location: ['Hand position too low', 'Movement too large']
    }
  },
  'Good': {
    difficulty: 1,
    description: 'Place your right hand flat against your lips, then move it down and away',
    common_mistakes: {
      handshape: ['Fingers not together', 'Palm not flat'],
      movement: ['Movement too fast', 'Not moving outward enough'],
      location: ['Starting too far from lips', 'Wrong hand angle']
    }
  }
};

/**
 * Generates a perturbed version of landmarks to simulate student attempts
 */
export function generatePerturbedLandmarks(
  landmarks: HandLandmarkFrame[],
  perturbationRange = 0.03 // ±3% by default
): HandLandmarkFrame[] {
  return landmarks.map(frame => ({
    ...frame,
    landmarks: frame.landmarks.map(handLandmarks =>
      handLandmarks.map(landmark => ({
        x: landmark.x + (Math.random() * 2 - 1) * perturbationRange,
        y: landmark.y + (Math.random() * 2 - 1) * perturbationRange,
        z: landmark.z + (Math.random() * 2 - 1) * perturbationRange
      }))
    )
  }));
}

/**
 * Generates synthetic student attempts with varying levels of accuracy
 */
export function generateSyntheticAttempts(
  exemplar: HandLandmarkFrame[],
  count: number
): HandLandmarkFrame[][] {
  const attempts: HandLandmarkFrame[][] = [];
  
  // Generate attempts with different perturbation levels
  for (let i = 0; i < count; i++) {
    // Vary perturbation from 1% to 10% for different skill levels
    const perturbation = 0.01 + (Math.random() * 0.09);
    attempts.push(generatePerturbedLandmarks(exemplar, perturbation));
  }
  
  return attempts;
}

/**
 * Creates an exemplar sign with metadata
 */
export function createExemplarSign(
  name: typeof COMMON_SIGNS[number],
  landmarks: HandLandmarkFrame[]
): ReferenceSign {
  const metadata = SIGN_METADATA[name];
  
  return {
    id: `exemplar-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    description: metadata.description,
    difficulty: metadata.difficulty,
    common_mistakes: metadata.common_mistakes,
    landmark_data_url: '', // Will be set after upload
    video_url: '', // Will be set after upload
    created_at: new Date().toISOString(),
    metadata: {
      category: 'common_phrases',
      status: 'published',
      tags: ['exemplar', 'common', name.toLowerCase()],
      created_by: 'system',
      landmarks
    }
  };
}

/**
 * Generates a complete set of exemplar data with synthetic attempts
 */
export async function generateExemplarDataset() {
  const dataset: {
    exemplars: ReferenceSign[];
    syntheticAttempts: Record<string, HandLandmarkFrame[][]>;
  } = {
    exemplars: [],
    syntheticAttempts: {}
  };

  // Generate exemplars and synthetic attempts for each common sign
  for (const sign of COMMON_SIGNS) {
    if (BASE_HAND_STRUCTURE[sign]) {
      const exemplar = createExemplarSign(sign, BASE_HAND_STRUCTURE[sign].frames);
      dataset.exemplars.push(exemplar);
      
      // Generate 10 synthetic attempts for each sign
      dataset.syntheticAttempts[sign] = generateSyntheticAttempts(
        BASE_HAND_STRUCTURE[sign].frames,
        10
      );
    }
  }

  return dataset;
}

/**
 * Saves exemplar data to JSON files
 */
export async function saveExemplarData(dataset: Awaited<ReturnType<typeof generateExemplarDataset>>) {
  // In a real implementation, this would write to files
  // For now, we'll just log the data
  console.log('Generated exemplar data:', {
    exemplarCount: dataset.exemplars.length,
    attemptCounts: Object.entries(dataset.syntheticAttempts)
      .map(([sign, attempts]) => `${sign}: ${attempts.length} attempts`)
  });
  
  return dataset;
}
