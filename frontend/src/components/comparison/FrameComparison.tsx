import React, { useEffect, useRef, useState } from 'react';
import type { HandLandmarkFrame } from '../../types/landmarks';
import { generateHeatmap } from '../../utils/dtw';

interface FrameComparisonProps {
  referenceFrames: HandLandmarkFrame[];
  studentFrames: HandLandmarkFrame[];
  currentFrameIndex: number;
  onFrameChange?: (index: number) => void;
}

const COLORS = {
  reference: '#2563eb', // Blue
  student: '#dc2626',   // Red
  match: '#16a34a',     // Green
  background: '#f8fafc', // Light gray
};

const CANVAS_SIZE = {
  width: 400,
  height: 300
};

const LANDMARK_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [0, 5], [5, 9], [9, 13], [13, 17]
];

function normalizeLandmarks(landmarks: { x: number; y: number; z: number }[]) {
  if (landmarks.length === 0) return landmarks;
  
  // Find the bounding box
  const xs = landmarks.map(p => p.x);
  const ys = landmarks.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  // Calculate scale to fit in a reasonable area (70% of canvas)
  const width = maxX - minX;
  const height = maxY - minY;
  const targetSize = 0.7;
  const scale = Math.min(targetSize / width, targetSize / height);
  
  // Center the hand
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const targetCenterX = 0.5;
  const targetCenterY = 0.5;
  
  return landmarks.map(point => ({
    x: targetCenterX + (point.x - centerX) * scale,
    y: targetCenterY + (point.y - centerY) * scale,
    z: point.z,
    confidence: (point as any).confidence
  }));
}

function drawHandWithOffset(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number; z: number }[],
  color: string,
  offsetX = 0,
  offsetY = 0
) {
  // Draw connections
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  LANDMARK_CONNECTIONS.forEach(([i, j]) => {
    const start = landmarks[i];
    const end = landmarks[j];
    
    ctx.beginPath();
    ctx.moveTo(
      start.x * CANVAS_SIZE.width + offsetX, 
      start.y * CANVAS_SIZE.height + offsetY
    );
    ctx.lineTo(
      end.x * CANVAS_SIZE.width + offsetX, 
      end.y * CANVAS_SIZE.height + offsetY
    );
    ctx.stroke();
  });

  // Draw landmarks
  ctx.fillStyle = color;
  landmarks.forEach(point => {
    ctx.beginPath();
    ctx.arc(
      point.x * CANVAS_SIZE.width + offsetX,
      point.y * CANVAS_SIZE.height + offsetY,
      4, // Slightly larger for better visibility
      0,
      2 * Math.PI
    );
    ctx.fill();
  });
}

export function FrameComparison({
  referenceFrames,
  studentFrames,
  currentFrameIndex,
  onFrameChange
}: FrameComparisonProps) {
  // Guard against undefined or empty inputs
  const hasValidData = Array.isArray(referenceFrames) && Array.isArray(studentFrames) && referenceFrames.length > 0 && studentFrames.length > 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [heatmap, setHeatmap] = useState<Array<{ frameIndex: number; differences: number[] }>>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    if (!hasValidData) {
      setHeatmap([]);
      return;
    }
    // Generate heatmap data
    const heatmapData = generateHeatmap(referenceFrames, studentFrames);
    setHeatmap(heatmapData);
  }, [referenceFrames, studentFrames, hasValidData]);

  useEffect(() => {
    if (!hasValidData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);

    // Get current frames
    const referenceFrame = referenceFrames[currentFrameIndex];
    const studentFrame = studentFrames[currentFrameIndex];

    if (!referenceFrame?.landmarks[0] || !studentFrame?.landmarks[0]) return;

    // Normalize landmark coordinates to ensure both hands are visible
    const refLandmarks = normalizeLandmarks(referenceFrame.landmarks[0]);
    const studentLandmarks = normalizeLandmarks(studentFrame.landmarks[0]);

    // Draw reference hand (slightly offset to make both visible)
    drawHandWithOffset(ctx, refLandmarks, COLORS.reference, -20, 0);

    // Draw student hand
    drawHandWithOffset(ctx, studentLandmarks, COLORS.student, 20, 0);

    // Draw heatmap overlay on student hand
    const frameDifferences = heatmap[currentFrameIndex]?.differences;
    if (frameDifferences) {
      studentLandmarks.forEach((landmark, i) => {
        const difference = frameDifferences[i];
        // Normalize difference to 0-1 range (assuming max reasonable difference is 0.2)
        const normalizedDiff = Math.min(1, difference / 0.2);
        
        // Create color gradient from green (good) to red (bad)
        const red = Math.floor(255 * normalizedDiff);
        const green = Math.floor(255 * (1 - normalizedDiff));
        const alpha = 0.7;
        
        // Draw filled circle for heatmap (on student hand position)
        ctx.beginPath();
        ctx.fillStyle = `rgba(${red}, ${green}, 0, ${alpha})`;
        ctx.arc(
          landmark.x * CANVAS_SIZE.width + 20, // Match student offset
          landmark.y * CANVAS_SIZE.height,
          8, // Larger radius for better visibility
          0,
          2 * Math.PI
        );
        ctx.fill();
        
        // Add white border for visibility
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.arc(
          landmark.x * CANVAS_SIZE.width + 20, // Match student offset
          landmark.y * CANVAS_SIZE.height,
          8,
          0,
          2 * Math.PI
        );
        ctx.stroke();
      });
    }
  }, [currentFrameIndex, referenceFrames, studentFrames, heatmap, hasValidData]);

  useEffect(() => {
    if (!isPlaying || !hasValidData) return;

    const interval = setInterval(() => {
      const maxIndex = referenceFrames.length - 1;
      const nextIndex = currentFrameIndex >= maxIndex ? 0 : currentFrameIndex + 1;
      onFrameChange?.(nextIndex);
    }, 1000 / (30 * playbackSpeed));

    return () => clearInterval(interval);
  }, [isPlaying, currentFrameIndex, referenceFrames, playbackSpeed, onFrameChange, hasValidData]);

  if (!hasValidData) {
    return (
      <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow text-sm text-gray-600">
        No frame data available yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE.width}
        height={CANVAS_SIZE.height}
        className="border border-gray-200 rounded"
      />

      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
          className="px-2 py-1 text-sm border border-gray-300 rounded"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
        </select>

        <input
          type="range"
          min={0}
          max={referenceFrames.length - 1}
          value={currentFrameIndex}
          onChange={(e) => onFrameChange?.(Number(e.target.value))}
          className="w-48"
        />

        <span className="text-sm text-gray-600">
          Frame {currentFrameIndex + 1} of {referenceFrames.length}
        </span>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: COLORS.reference }} />
          <span>Reference</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: COLORS.student }} />
          <span>Student</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'rgba(0, 255, 0, 0.7)' }} />
          <span>Good</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: 'rgba(255, 0, 0, 0.7)' }} />
          <span>Needs Work</span>
        </div>
      </div>
    </div>
  );
}

