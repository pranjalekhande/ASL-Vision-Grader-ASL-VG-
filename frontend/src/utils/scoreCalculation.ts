/**
 * Unified score calculation utilities for ASL Vision Grader
 * Provides consistent scoring across the application
 */

export interface ScoreData {
  score_shape: number | null;
  score_location: number | null;
  score_movement: number | null;
}

export interface StudentAttemptScore extends ScoreData {
  id: string;
  created_at: string;
}

/**
 * Calculate overall score for a single attempt
 * @param attempt - Attempt with score data
 * @returns Overall score (0-100) or null if invalid scores
 */
export const calculateOverallScore = (attempt: ScoreData): number | null => {
  // Validate that all scores exist and are valid numbers
  if (
    attempt.score_shape === null || 
    attempt.score_location === null || 
    attempt.score_movement === null ||
    isNaN(attempt.score_shape) ||
    isNaN(attempt.score_location) ||
    isNaN(attempt.score_movement)
  ) {
    return null;
  }

  // Calculate average of the three scores
  const overallScore = (attempt.score_shape + attempt.score_location + attempt.score_movement) / 3;
  return Math.round(overallScore);
};

/**
 * Calculate average score across multiple attempts
 * @param attempts - Array of attempts with score data
 * @returns Average score (0-100) or 0 if no valid attempts
 */
export const calculateAverageScore = (attempts: ScoreData[]): number => {
  // Filter to only valid attempts
  const validAttempts = attempts.filter(attempt => 
    calculateOverallScore(attempt) !== null
  );

  if (validAttempts.length === 0) {
    return 0;
  }

  // Calculate sum of all individual scores (not overall scores)
  const totalScore = validAttempts.reduce((sum, attempt) => 
    sum + (attempt.score_shape! + attempt.score_location! + attempt.score_movement!), 0
  );

  // Average across all individual scores (3 scores per attempt)
  const averageScore = totalScore / (validAttempts.length * 3);
  return Math.round(averageScore);
};

/**
 * Count attempts with high scores (80% or above)
 * @param attempts - Array of attempts with score data
 * @param threshold - Score threshold (default: 80)
 * @returns Count of high-scoring attempts
 */
export const countHighScoreAttempts = (attempts: ScoreData[], threshold: number = 80): number => {
  return attempts.filter(attempt => {
    const overallScore = calculateOverallScore(attempt);
    return overallScore !== null && overallScore >= threshold;
  }).length;
};

/**
 * Get score statistics for a set of attempts
 * @param attempts - Array of attempts with score data
 * @returns Statistics object with various score metrics
 */
export const getScoreStatistics = (attempts: ScoreData[]) => {
  const validAttempts = attempts.filter(attempt => 
    calculateOverallScore(attempt) !== null
  );

  if (validAttempts.length === 0) {
    return {
      totalAttempts: attempts.length,
      validAttempts: 0,
      averageScore: 0,
      highScoreCount: 0,
      highScorePercentage: 0,
      bestScore: 0,
      worstScore: 0,
      improvementTrend: 0 // Positive = improving, negative = declining
    };
  }

  const overallScores = validAttempts
    .map(attempt => calculateOverallScore(attempt)!)
    .filter(score => score !== null);

  const averageScore = calculateAverageScore(validAttempts);
  const highScoreCount = countHighScoreAttempts(validAttempts);
  const bestScore = Math.max(...overallScores);
  const worstScore = Math.min(...overallScores);

  // Calculate improvement trend (comparing first half vs second half)
  let improvementTrend = 0;
  if (overallScores.length >= 4) {
    const midPoint = Math.floor(overallScores.length / 2);
    const firstHalf = overallScores.slice(0, midPoint);
    const secondHalf = overallScores.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    improvementTrend = Math.round(secondHalfAvg - firstHalfAvg);
  }

  return {
    totalAttempts: attempts.length,
    validAttempts: validAttempts.length,
    averageScore,
    highScoreCount,
    highScorePercentage: Math.round((highScoreCount / validAttempts.length) * 100),
    bestScore,
    worstScore,
    improvementTrend
  };
};

/**
 * Categorize score performance
 * @param score - Overall score (0-100)
 * @returns Performance category and color class
 */
export const categorizeScore = (score: number | null) => {
  if (score === null) {
    return {
      category: 'No Score',
      color: 'bg-gray-100 text-gray-800',
      description: 'Incomplete data'
    };
  }

  if (score >= 90) {
    return {
      category: 'Excellent',
      color: 'bg-green-100 text-green-800',
      description: 'Outstanding performance'
    };
  } else if (score >= 80) {
    return {
      category: 'Good',
      color: 'bg-green-100 text-green-800',
      description: 'Good performance'
    };
  } else if (score >= 70) {
    return {
      category: 'Fair',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Needs improvement'
    };
  } else if (score >= 60) {
    return {
      category: 'Needs Work',
      color: 'bg-orange-100 text-orange-800',
      description: 'Significant improvement needed'
    };
  } else {
    return {
      category: 'Poor',
      color: 'bg-red-100 text-red-800',
      description: 'Needs major improvement'
    };
  }
};

/**
 * Format score for display with appropriate precision
 * @param score - Score value
 * @param includePercent - Whether to include % symbol
 * @returns Formatted score string
 */
export const formatScore = (score: number | null, includePercent: boolean = true): string => {
  if (score === null) {
    return 'N/A';
  }
  
  return `${Math.round(score)}${includePercent ? '%' : ''}`;
};
