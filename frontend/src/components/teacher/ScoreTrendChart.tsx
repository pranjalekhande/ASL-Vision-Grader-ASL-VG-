import React, { useRef, useEffect, useState } from 'react';
import { calculateOverallScore } from '../../utils/scoreCalculation';

interface ScoreTrendPoint {
  attemptId: string;
  date: Date;
  scores: {
    shape: number;
    location: number;
    movement: number;
    overall: number;
  };
  studentName: string;
  signName: string;
}

interface ScoreTrendChartProps {
  attempts: any[];
  onPointClick?: (attemptId: string) => void;
  height?: number;
  showLegend?: boolean;
  filterBy?: 'all' | 'student' | 'sign';
  selectedFilter?: string;
}

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  attempts,
  onPointClick,
  height = 300,
  showLegend = true,
  filterBy = 'all',
  selectedFilter
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [hoveredPoint, setHoveredPoint] = useState<ScoreTrendPoint | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Process attempts into trend data
  const trendData: ScoreTrendPoint[] = attempts
    .filter(attempt => {
      // Apply filters
      if (filterBy === 'student' && selectedFilter) {
        return attempt.student_name === selectedFilter;
      }
      if (filterBy === 'sign' && selectedFilter) {
        return attempt.sign_name === selectedFilter;
      }
      return true;
    })
    .filter(attempt => 
      attempt.score_shape !== null && 
      attempt.score_location !== null && 
      attempt.score_movement !== null
    )
    .map(attempt => ({
      attemptId: attempt.id,
      date: new Date(attempt.created_at),
      scores: {
        shape: attempt.score_shape,
        location: attempt.score_location,
        movement: attempt.score_movement,
        overall: calculateOverallScore(attempt) || 0
      },
      studentName: attempt.student_name || 'Unknown',
      signName: attempt.sign_name
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || trendData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Chart margins
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    const chartHeight = dimensions.height - margin.top - margin.bottom;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Find data bounds
    const minDate = Math.min(...trendData.map(d => d.date.getTime()));
    const maxDate = Math.max(...trendData.map(d => d.date.getTime()));
    const minScore = 0;
    const maxScore = 100;

    // Scale functions
    const scaleX = (date: Date) => margin.left + ((date.getTime() - minDate) / (maxDate - minDate)) * chartWidth;
    const scaleY = (score: number) => margin.top + ((maxScore - score) / (maxScore - minScore)) * chartHeight;

    // Draw grid lines
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // Horizontal grid lines (scores)
    for (let score = 0; score <= 100; score += 20) {
      const y = scaleY(score);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
    }

    // Vertical grid lines (time)
    const timeSteps = 5;
    for (let i = 0; i <= timeSteps; i++) {
      const time = minDate + (maxDate - minDate) * (i / timeSteps);
      const x = scaleX(new Date(time));
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;

    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.stroke();

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';

    // Y-axis labels (scores)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let score = 0; score <= 100; score += 20) {
      const y = scaleY(score);
      ctx.fillText(`${score}%`, margin.left - 10, y);
    }

    // X-axis labels (dates)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= timeSteps; i++) {
      const time = minDate + (maxDate - minDate) * (i / timeSteps);
      const x = scaleX(new Date(time));
      const date = new Date(time);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      ctx.fillText(label, x, margin.top + chartHeight + 10);
    }

    // Line colors
    const lineColors = {
      shape: '#3b82f6',    // blue
      location: '#10b981', // green
      movement: '#8b5cf6', // purple
      overall: '#ef4444'   // red
    };

    // Draw lines for each score type
    Object.entries(lineColors).forEach(([scoreType, color]) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      trendData.forEach((point, index) => {
        const x = scaleX(point.date);
        const y = scaleY(point.scores[scoreType as keyof typeof point.scores]);

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    });

    // Draw data points
    trendData.forEach(point => {
      Object.entries(lineColors).forEach(([scoreType, color]) => {
        const x = scaleX(point.date);
        const y = scaleY(point.scores[scoreType as keyof typeof point.scores]);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();

        // Add white border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    // Highlight hovered point
    if (hoveredPoint) {
      const x = scaleX(hoveredPoint.date);
      Object.entries(lineColors).forEach(([scoreType, color]) => {
        const y = scaleY(hoveredPoint.scores[scoreType as keyof typeof hoveredPoint.scores]);
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      });
    }

  }, [dimensions, trendData, hoveredPoint]);

  // Handle mouse events
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || trendData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setMousePosition({ x: event.clientX, y: event.clientY });

    // Find closest point
    const margin = { top: 20, right: 20, bottom: 60, left: 60 };
    const chartWidth = dimensions.width - margin.left - margin.right;
    
    const minDate = Math.min(...trendData.map(d => d.date.getTime()));
    const maxDate = Math.max(...trendData.map(d => d.date.getTime()));
    
    const scaleX = (date: Date) => margin.left + ((date.getTime() - minDate) / (maxDate - minDate)) * chartWidth;

    let closestPoint: ScoreTrendPoint | null = null;
    let closestDistance = Infinity;

    trendData.forEach(point => {
      const pointX = scaleX(point.date);
      const distance = Math.abs(x - pointX);
      
      if (distance < closestDistance && distance < 20) {
        closestDistance = distance;
        closestPoint = point;
      }
    });

    setHoveredPoint(closestPoint);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredPoint && onPointClick) {
      onPointClick(hoveredPoint.attemptId);
    }
  };

  if (trendData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Score Trends</h3>
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No score data available for trends</p>
          <p className="text-sm mt-1">Data will appear as students submit attempts with scores</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Score Trends</h3>
        {showLegend && (
          <div className="flex space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span>Shape</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
              <span>Location</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded mr-2"></div>
              <span>Movement</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
              <span>Overall</span>
            </div>
          </div>
        )}
      </div>

      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          className="w-full cursor-pointer"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />

        {/* Tooltip */}
        {hoveredPoint && (
          <div 
            className="fixed z-50 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 pointer-events-none shadow-lg"
            style={{
              left: mousePosition.x + 10,
              top: mousePosition.y - 10,
              transform: 'translateY(-100%)'
            }}
          >
            <div className="font-medium">{hoveredPoint.signName}</div>
            <div className="text-gray-300">{hoveredPoint.studentName}</div>
            <div className="text-gray-300">{hoveredPoint.date.toLocaleDateString()}</div>
            <div className="mt-1 space-y-1">
              <div className="flex justify-between">
                <span className="text-blue-300">Shape:</span>
                <span>{hoveredPoint.scores.shape}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-300">Location:</span>
                <span>{hoveredPoint.scores.location}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300">Movement:</span>
                <span>{hoveredPoint.scores.movement}%</span>
              </div>
              <div className="flex justify-between border-t border-gray-600 pt-1">
                <span className="text-red-300">Overall:</span>
                <span className="font-medium">{hoveredPoint.scores.overall}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
