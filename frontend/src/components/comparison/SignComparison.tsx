import React, { useState } from 'react';
import type { HandLandmarkFrame } from '../../types/landmarks';
import { FrameComparison } from './FrameComparison';
import { ScoreBreakdown } from './ScoreBreakdown';

interface SignComparisonProps {
  referenceFrames: HandLandmarkFrame[];
  studentFrames: HandLandmarkFrame[];
  signMetadata?: {
    name: string;
    description: string;
    difficulty: number;
    common_mistakes: {
      handshape: string[];
      movement: string[];
      location: string[];
    };
  };
}

export function SignComparison({
  referenceFrames,
  studentFrames,
  signMetadata
}: SignComparisonProps) {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  return (
    <div className="flex flex-col gap-8 p-4">
      {/* Sign Information */}
      {signMetadata && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-2">{signMetadata.name}</h2>
          <p className="text-gray-600 mb-4">{signMetadata.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Difficulty:</span>
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className={`w-5 h-5 ${
                    i < signMetadata.difficulty
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Frame Comparison */}
        <div className="lg:col-span-1">
          <FrameComparison
            referenceFrames={referenceFrames}
            studentFrames={studentFrames}
            currentFrameIndex={currentFrameIndex}
            onFrameChange={setCurrentFrameIndex}
          />
        </div>

        {/* Score Breakdown */}
        <div className="lg:col-span-1">
          <ScoreBreakdown
            referenceFrames={referenceFrames}
            studentFrames={studentFrames}
            commonMistakes={signMetadata?.common_mistakes}
          />
        </div>
      </div>
    </div>
  );
}

