import React, { useEffect, useRef } from 'react';
import type { ComparisonState } from '../../hooks/useComparison';

interface ScoreDisplayProps {
  comparison: ComparisonState;
  width?: number;
  height?: number;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  comparison,
  width = 600,
  height = 400
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw heatmap visualization
  useEffect(() => {
    if (!canvasRef.current || !comparison.heatmap) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw heatmap
    const heatmap = comparison.heatmap;
    const cellWidth = canvas.width / heatmap.length;
    const cellHeight = canvas.height / 21; // 21 landmarks per hand

    heatmap.forEach((frame, frameIndex) => {
      frame.differences.forEach((difference, landmarkIndex) => {
        // Normalize difference to 0-1 range (assuming max difference of 1.0)
        const normalizedDiff = Math.min(difference, 1.0);
        
        // Create color gradient from green (good) to red (bad)
        const red = Math.round(255 * normalizedDiff);
        const green = Math.round(255 * (1 - normalizedDiff));
        
        ctx.fillStyle = `rgb(${red}, ${green}, 0)`;
        ctx.fillRect(
          frameIndex * cellWidth,
          landmarkIndex * cellHeight,
          cellWidth,
          cellHeight
        );
      });
    });
  }, [comparison.heatmap]);

  if (!comparison.scores) {
    return comparison.isComparing ? (
      <div className="flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
          <div className="text-sm text-gray-600">
            Comparing signs... {comparison.progress}%
          </div>
        </div>
      </div>
    ) : null;
  }

  const { overall, handshape, location, movement } = comparison.scores;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const ScoreBar: React.FC<{ label: string; score: number }> = ({ label, score }) => (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-medium ${getScoreColor(score)}`}>
          {score}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getScoreColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-center mb-2">Sign Comparison Results</h2>
        <div className={`text-4xl font-bold text-center ${getScoreColor(overall)} mb-4`}>
          {overall}%
        </div>
        
        <div className="space-y-4">
          <ScoreBar label="Handshape Accuracy" score={handshape} />
          <ScoreBar label="Location Accuracy" score={location} />
          <ScoreBar label="Movement Accuracy" score={movement} />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Detailed Comparison</h3>
        <div className="border rounded-lg p-2 bg-gray-50">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full"
            style={{ aspectRatio: width / height }}
            data-testid="heatmap-canvas"
          />
          <div className="text-xs text-gray-500 mt-2 text-center">
            Heatmap visualization: Green indicates good match, Red indicates areas for improvement
          </div>
        </div>
      </div>
    </div>
  );
};
