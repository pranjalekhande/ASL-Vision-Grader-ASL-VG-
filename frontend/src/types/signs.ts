import type { HandLandmarkFrame } from './landmarks';

/**
 * Difficulty level of a sign
 */
export type SignDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * Categories or topics that a sign belongs to
 */
export type SignCategory = 
  | 'alphabet'
  | 'numbers'
  | 'common_phrases'
  | 'greetings'
  | 'emotions'
  | 'colors'
  | 'time'
  | 'family'
  | 'food'
  | 'animals'
  | 'weather'
  | 'other';

/**
 * Status of a reference sign
 */
export type SignStatus = 'draft' | 'published' | 'archived';

/**
 * Metadata for a reference sign
 */
export interface SignMetadata {
  id: string;
  name: string;
  description: string;
  difficulty: SignDifficulty;
  category: SignCategory;
  status: SignStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  videoUrl: string;
  thumbnailUrl?: string;
}

/**
 * Reference sign data including landmarks
 */
export interface ReferenceSign extends SignMetadata {
  landmarks: HandLandmarkFrame[];
}

/**
 * Input for creating a new reference sign
 */
export interface CreateSignInput {
  name: string;
  description: string;
  difficulty: SignDifficulty;
  category: SignCategory;
  tags: string[];
  videoBlob: Blob;
  landmarks: HandLandmarkFrame[];
}

/**
 * Input for updating an existing reference sign
 */
export interface UpdateSignInput {
  id: string;
  name?: string;
  description?: string;
  difficulty?: SignDifficulty;
  category?: SignCategory;
  tags?: string[];
  status?: SignStatus;
  videoBlob?: Blob;
  landmarks?: HandLandmarkFrame[];
}

/**
 * Search parameters for finding reference signs
 */
export interface SignSearchParams {
  query?: string;
  difficulty?: SignDifficulty;
  category?: SignCategory;
  tags?: string[];
  status?: SignStatus;
  createdBy?: string;
  page?: number;
  limit?: number;
}

/**
 * Result of a sign comparison
 */
export interface SignComparisonResult {
  signId: string;
  overallScore: number;
  handshapeScore: number;
  locationScore: number;
  movementScore: number;
  feedback: string;
  timestamp: string;
}

/**
 * Progress tracking for a user learning a sign
 */
export interface SignProgress {
  userId: string;
  signId: string;
  attempts: number;
  bestScore: number;
  lastAttempt: string;
  mastered: boolean;
  history: SignComparisonResult[];
}


