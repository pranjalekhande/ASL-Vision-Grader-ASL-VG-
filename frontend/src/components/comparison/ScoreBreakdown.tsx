import type { HandLandmarkFrame } from '../../types/landmarks';
import { calculateComprehensiveScore } from '../../utils/scoring';

interface ScoreBreakdownProps {
  referenceFrames: HandLandmarkFrame[];
  studentFrames: HandLandmarkFrame[];
  commonMistakes?: {
    handshape: string[];
    movement: string[];
    location: string[];
  };
}

interface ScoreBarProps {
  label: string;
  score: number;
  color: string;
}

function ScoreBar({ label, score, color }: ScoreBarProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{Math.round(score)}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded overflow-hidden">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${score}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
}

interface ConfidenceIndicatorProps {
  confidence: number;
}

function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  let color = 'bg-red-500';
  let text = 'Poor';

  if (confidence >= 90) {
    color = 'bg-green-500';
    text = 'Excellent';
  } else if (confidence >= 70) {
    color = 'bg-yellow-500';
    text = 'Good';
  } else if (confidence >= 50) {
    color = 'bg-orange-500';
    text = 'Fair';
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-sm text-gray-600">
        Confidence: {text} ({Math.round(confidence)}%)
      </span>
    </div>
  );
}

export function ScoreBreakdown({
  referenceFrames,
  studentFrames,
  commonMistakes
}: ScoreBreakdownProps) {
  const hasValidData = Array.isArray(referenceFrames) && Array.isArray(studentFrames) && referenceFrames.length > 0 && studentFrames.length > 0;

  const scores = hasValidData
    ? calculateComprehensiveScore(referenceFrames, studentFrames, { commonMistakes })
    : {
        total: 0,
        handshape: 0,
        location: 0,
        movement: 0,
        timing: 0,
        confidence: 0,
        feedback: [] as string[]
      };

  if (!hasValidData) {
    return (
      <div className="flex flex-col gap-6 p-6 bg-white rounded-lg shadow text-sm text-gray-600">
        Waiting for frame data...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-lg shadow">
      {/* Overall Score */}
      <div className="text-center">
        <div className="text-5xl font-bold mb-2">{scores.total}</div>
        <div className="text-gray-600">Overall Score</div>
        <ConfidenceIndicator confidence={scores.confidence} />
      </div>

      {/* Score Breakdown */}
      <div className="space-y-4">
        <ScoreBar
          label="Hand Shape"
          score={scores.handshape}
          color="#2563eb"
        />
        <ScoreBar
          label="Location"
          score={scores.location}
          color="#16a34a"
        />
        <ScoreBar
          label="Movement"
          score={scores.movement}
          color="#dc2626"
        />
        <ScoreBar
          label="Timing"
          score={scores.timing}
          color="#9333ea"
        />
      </div>

      {/* Feedback */}
      {scores.feedback.length > 0 && (
        <div className="mt-6">
          <h3 className="font-medium text-gray-900 mb-2">Feedback</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            {scores.feedback.map((feedback, index) => (
              <li key={index}>{feedback}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Score Legend */}
      <div className="text-sm text-gray-500 mt-4">
        <div className="font-medium mb-2">Score Breakdown:</div>
        <ul className="space-y-1">
          <li>• Hand Shape (40%): Accuracy of finger positions and hand configuration</li>
          <li>• Location (30%): Correct positioning of the sign in space</li>
          <li>• Movement (30%): Accuracy of hand motion and timing</li>
          <li>• Timing: Consistency and speed of the sign execution</li>
          <li>• Confidence: Quality and clarity of hand tracking</li>
        </ul>
      </div>
    </div>
  );
}
