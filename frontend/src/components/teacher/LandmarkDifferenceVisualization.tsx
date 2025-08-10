import React, { useRef, useEffect, useCallback } from 'react';
import type { HandLandmarkFrame, NormalizedLandmark } from '../../types/landmarks';

interface LandmarkDifferenceVisualizationProps {
  studentLandmarks: HandLandmarkFrame;
  exemplarLandmarks: HandLandmarkFrame;
  width?: number;
  height?: number;
  showDifferences?: boolean;
  showConnections?: boolean;
  highlightDeviations?: boolean;
  deviationThreshold?: number;
  colorScheme?: 'default' | 'heatmap' | 'categorical';
}

interface LandmarkDifference {
  index: number;
  distance: number;
  severity: 'low' | 'medium' | 'high';
  category: 'shape' | 'location' | 'movement';
}

const HAND_CONNECTIONS = [
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
  // Palm connections
  [5, 9], [9, 13], [13, 17]
];

export const LandmarkDifferenceVisualization: React.FC<LandmarkDifferenceVisualizationProps> = ({
  studentLandmarks,
  exemplarLandmarks,
  width = 640,
  height = 480,
  showDifferences = true,
  showConnections = true,
  highlightDeviations = true,
  deviationThreshold = 0.1,
  colorScheme = 'default'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate distance between two landmarks
  const calculateDistance = useCallback((landmark1: NormalizedLandmark, landmark2: NormalizedLandmark): number => {
    const dx = landmark1.x - landmark2.x;
    const dy = landmark1.y - landmark2.y;
    const dz = (landmark1.z || 0) - (landmark2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, []);

  // Calculate differences between student and exemplar landmarks
  const calculateDifferences = useCallback((): LandmarkDifference[] => {
    if (!studentLandmarks.landmarks || !exemplarLandmarks.landmarks) return [];

    const differences: LandmarkDifference[] = [];

    // Compare each hand
    for (let handIndex = 0; handIndex < Math.min(studentLandmarks.landmarks.length, exemplarLandmarks.landmarks.length); handIndex++) {
      const studentHand = studentLandmarks.landmarks[handIndex];
      const exemplarHand = exemplarLandmarks.landmarks[handIndex];

      // Compare each landmark
      for (let i = 0; i < Math.min(studentHand.length, exemplarHand.length); i++) {
        const distance = calculateDistance(studentHand[i], exemplarHand[i]);
        
        let severity: 'low' | 'medium' | 'high';
        if (distance < deviationThreshold) severity = 'low';
        else if (distance < deviationThreshold * 2) severity = 'medium';
        else severity = 'high';

        // Categorize by landmark type
        let category: 'shape' | 'location' | 'movement';
        if (i >= 0 && i <= 4) category = 'shape'; // Thumb
        else if (i >= 5 && i <= 20) category = 'shape'; // Fingers
        else category = 'location'; // Palm/wrist

        differences.push({
          index: i,
          distance,
          severity,
          category
        });
      }
    }

    return differences;
  }, [studentLandmarks, exemplarLandmarks, calculateDistance, deviationThreshold]);

  // Get color for landmark based on difference
  const getLandmarkColor = useCallback((difference: LandmarkDifference | null): string => {
    if (!difference || !showDifferences) {
      return colorScheme === 'default' ? '#00FF00' : '#4ADE80';
    }

    switch (colorScheme) {
      case 'heatmap':
        if (difference.severity === 'high') return '#EF4444'; // Red
        if (difference.severity === 'medium') return '#F59E0B'; // Orange
        return '#10B981'; // Green
      
      case 'categorical':
        if (difference.category === 'shape') return '#3B82F6'; // Blue
        if (difference.category === 'location') return '#8B5CF6'; // Purple
        return '#F59E0B'; // Orange for movement
      
      default:
        if (difference.severity === 'high') return '#EF4444';
        if (difference.severity === 'medium') return '#F59E0B';
        return '#10B981';
    }
  }, [showDifferences, colorScheme]);

  // Get connection color based on endpoint differences
  const getConnectionColor = useCallback((diff1: LandmarkDifference | null, diff2: LandmarkDifference | null): string => {
    if (!showDifferences || (!diff1 && !diff2)) {
      return colorScheme === 'default' ? '#00FF00' : '#4ADE80';
    }

    const maxSeverity = Math.max(
      diff1?.severity === 'high' ? 3 : diff1?.severity === 'medium' ? 2 : 1,
      diff2?.severity === 'high' ? 3 : diff2?.severity === 'medium' ? 2 : 1
    );

    switch (colorScheme) {
      case 'heatmap':
        if (maxSeverity === 3) return '#EF4444';
        if (maxSeverity === 2) return '#F59E0B';
        return '#10B981';
      
      default:
        if (maxSeverity === 3) return '#EF4444';
        if (maxSeverity === 2) return '#F59E0B';
        return '#10B981';
    }
  }, [showDifferences, colorScheme]);

  // Draw landmarks and connections
  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const differences = calculateDifferences();
    const diffMap = new Map(differences.map(d => [d.index, d]));

    // Draw both student and exemplar landmarks
    if (studentLandmarks.landmarks && exemplarLandmarks.landmarks) {
      for (let handIndex = 0; handIndex < Math.min(studentLandmarks.landmarks.length, exemplarLandmarks.landmarks.length); handIndex++) {
        const studentHand = studentLandmarks.landmarks[handIndex];
        const exemplarHand = exemplarLandmarks.landmarks[handIndex];

        // Draw connections first (behind landmarks)
        if (showConnections) {
          ctx.lineWidth = 2;
          
          HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
            if (startIdx < studentHand.length && endIdx < studentHand.length) {
              const startDiff = diffMap.get(startIdx);
              const endDiff = diffMap.get(endIdx);
              
              // Student connections
              ctx.strokeStyle = getConnectionColor(startDiff, endDiff);
              ctx.globalAlpha = 0.7;
              ctx.beginPath();
              ctx.moveTo(studentHand[startIdx].x * width, studentHand[startIdx].y * height);
              ctx.lineTo(studentHand[endIdx].x * width, studentHand[endIdx].y * height);
              ctx.stroke();

              // Exemplar connections (slightly transparent)
              ctx.strokeStyle = '#CCCCCC';
              ctx.globalAlpha = 0.3;
              ctx.beginPath();
              ctx.moveTo(exemplarHand[startIdx].x * width, exemplarHand[startIdx].y * height);
              ctx.lineTo(exemplarHand[endIdx].x * width, exemplarHand[endIdx].y * height);
              ctx.stroke();
            }
          });
        }

        // Draw landmarks
        ctx.globalAlpha = 1;
        
        // Student landmarks
        studentHand.forEach((landmark, index) => {
          if (landmark.visibility && landmark.visibility < 0.5) return;

          const difference = diffMap.get(index);
          const color = getLandmarkColor(difference);
          
          ctx.beginPath();
          ctx.arc(landmark.x * width, landmark.y * height, 6, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          
          // Add white border for visibility
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Draw deviation indicators for high differences
          if (highlightDeviations && difference && difference.severity === 'high') {
            ctx.beginPath();
            ctx.arc(landmark.x * width, landmark.y * height, 12, 0, 2 * Math.PI);
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });

        // Exemplar landmarks (as reference points, smaller and transparent)
        ctx.globalAlpha = 0.4;
        exemplarHand.forEach((landmark, index) => {
          if (landmark.visibility && landmark.visibility < 0.5) return;

          ctx.beginPath();
          ctx.arc(landmark.x * width, landmark.y * height, 3, 0, 2 * Math.PI);
          ctx.fillStyle = '#888888';
          ctx.fill();
        });
      }
    }

    ctx.globalAlpha = 1;
  }, [
    width, height, studentLandmarks, exemplarLandmarks, calculateDifferences,
    showConnections, highlightDeviations, getLandmarkColor, getConnectionColor
  ]);

  // Redraw when dependencies change
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);

  // Get summary statistics
  const getDifferenceSummary = useCallback(() => {
    const differences = calculateDifferences();
    const total = differences.length;
    const high = differences.filter(d => d.severity === 'high').length;
    const medium = differences.filter(d => d.severity === 'medium').length;
    const low = differences.filter(d => d.severity === 'low').length;

    return {
      total,
      high,
      medium,
      low,
      averageDistance: total > 0 ? differences.reduce((sum, d) => sum + d.distance, 0) / total : 0
    };
  }, [calculateDifferences]);

  const summary = getDifferenceSummary();

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-auto"
        />
        
        {/* Legend overlay */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded text-sm">
          <div className="font-semibold mb-2">Legend</div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Good alignment</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Minor deviation</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Major deviation</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span>Reference (exemplar)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary statistics */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Difference Analysis</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summary.high}</div>
            <div className="text-sm text-gray-600">High Deviations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
            <div className="text-sm text-gray-600">Medium Deviations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summary.low}</div>
            <div className="text-sm text-gray-600">Low Deviations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {(summary.averageDistance * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Avg. Distance</div>
          </div>
        </div>

        {/* Improvement suggestions */}
        {summary.high > 0 && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="font-medium text-red-800 mb-1">Areas for Improvement</div>
            <div className="text-sm text-red-700">
              {summary.high} landmarks show significant deviation from the reference. 
              Focus on hand shape and finger positioning.
            </div>
          </div>
        )}
        
        {summary.high === 0 && summary.medium > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <div className="font-medium text-yellow-800 mb-1">Minor Adjustments Needed</div>
            <div className="text-sm text-yellow-700">
              Good overall form! Minor adjustments to {summary.medium} landmarks could improve accuracy.
            </div>
          </div>
        )}
        
        {summary.high === 0 && summary.medium === 0 && (
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <div className="font-medium text-green-800 mb-1">Excellent Form!</div>
            <div className="text-sm text-green-700">
              All landmarks are well-aligned with the reference exemplar.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
