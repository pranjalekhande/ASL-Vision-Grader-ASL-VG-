import React, { useRef, useState, useCallback, useEffect } from 'react';

interface FeedbackMarker {
  id: string;
  timestamp: number;
  category: 'shape' | 'location' | 'movement' | 'general';
  content: string;
  severity: 'low' | 'medium' | 'high';
}

interface TimelineScrubberProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  feedbackMarkers?: FeedbackMarker[];
  onMarkerClick?: (marker: FeedbackMarker) => void;
  onAddMarker?: (timestamp: number) => void;
  frameCount?: number;
  currentFrame?: number;
  onFrameSeek?: (frame: number) => void;
  showFrameMarkers?: boolean;
  disabled?: boolean;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  duration,
  currentTime,
  onSeek,
  feedbackMarkers = [],
  onMarkerClick,
  onAddMarker,
  frameCount = 0,
  currentFrame = 0,
  onFrameSeek,
  showFrameMarkers = false,
  disabled = false
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredMarker, setHoveredMarker] = useState<FeedbackMarker | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Calculate timeline position from time
  const getPositionFromTime = useCallback((time: number) => {
    if (duration === 0) return 0;
    return Math.max(0, Math.min((time / duration) * 100, 100));
  }, [duration]);

  // Calculate time from position
  const getTimeFromPosition = useCallback((x: number, width: number) => {
    const percentage = Math.max(0, Math.min(x / width, 1));
    return percentage * duration;
  }, [duration]);

  // Handle timeline interactions
  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (disabled || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const newTime = getTimeFromPosition(x, rect.width);
    
    // Check if we're adding a marker (Ctrl/Cmd + click)
    if ((event.ctrlKey || event.metaKey) && onAddMarker) {
      onAddMarker(newTime);
      return;
    }

    onSeek(newTime);
  }, [disabled, getTimeFromPosition, onSeek, onAddMarker]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleTimelineClick(event);
  }, [disabled, handleTimelineClick]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging || disabled) return;
    handleTimelineClick(event);
  }, [isDragging, disabled, handleTimelineClick]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle marker interactions
  const handleMarkerHover = useCallback((marker: FeedbackMarker, event: React.MouseEvent) => {
    setHoveredMarker(marker);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const handleMarkerClick = useCallback((marker: FeedbackMarker, event: React.MouseEvent) => {
    event.stopPropagation();
    onMarkerClick?.(marker);
  }, [onMarkerClick]);

  // Frame navigation
  const handleFrameClick = useCallback((frameIndex: number) => {
    if (disabled || !onFrameSeek) return;
    onFrameSeek(frameIndex);
  }, [disabled, onFrameSeek]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (disabled) return;

      switch (event.key) {
        case 'Home':
          event.preventDefault();
          onSeek(0);
          break;
        case 'End':
          event.preventDefault();
          onSeek(duration);
          break;
        case 'PageUp':
          event.preventDefault();
          onSeek(Math.max(0, currentTime - 5)); // Skip 5 seconds back
          break;
        case 'PageDown':
          event.preventDefault();
          onSeek(Math.min(duration, currentTime + 5)); // Skip 5 seconds forward
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [disabled, duration, currentTime, onSeek]);

  // Global mouse events for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseUp = () => setIsDragging(false);
    
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const getMarkerColor = (category: string, severity: string) => {
    const colors = {
      shape: {
        low: 'bg-blue-400',
        medium: 'bg-blue-500',
        high: 'bg-blue-600'
      },
      location: {
        low: 'bg-green-400',
        medium: 'bg-green-500',
        high: 'bg-green-600'
      },
      movement: {
        low: 'bg-purple-400',
        medium: 'bg-purple-500',
        high: 'bg-purple-600'
      },
      general: {
        low: 'bg-gray-400',
        medium: 'bg-gray-500',
        high: 'bg-gray-600'
      }
    };
    return colors[category as keyof typeof colors]?.[severity as keyof typeof colors.shape] || 'bg-gray-500';
  };

  return (
    <div className="space-y-2">
      {/* Time labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>0:00</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Main timeline */}
      <div className="relative">
        <div
          ref={timelineRef}
          className={`relative h-8 bg-gray-200 rounded-lg cursor-pointer select-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'
          }`}
          onClick={handleTimelineClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDragging(false);
            setHoveredMarker(null);
          }}
        >
          {/* Progress bar */}
          <div
            className="absolute left-0 top-0 h-full bg-blue-500 rounded-lg transition-all duration-100"
            style={{
              width: `${getPositionFromTime(currentTime)}%`
            }}
          />

          {/* Feedback markers */}
          {feedbackMarkers.map((marker) => (
            <div
              key={marker.id}
              className={`absolute top-0 w-2 h-full cursor-pointer transform -translate-x-1/2 ${
                getMarkerColor(marker.category, marker.severity)
              } rounded-sm shadow-sm hover:shadow-md transition-all`}
              style={{
                left: `${getPositionFromTime(marker.timestamp)}%`
              }}
              onClick={(e) => handleMarkerClick(marker, e)}
              onMouseEnter={(e) => handleMarkerHover(marker, e)}
              onMouseLeave={() => setHoveredMarker(null)}
              title={`${marker.category}: ${marker.content}`}
            />
          ))}

          {/* Current time indicator */}
          <div
            className="absolute top-0 w-1 h-full bg-white shadow-lg transform -translate-x-1/2 transition-all duration-100"
            style={{
              left: `${getPositionFromTime(currentTime)}%`
            }}
          >
            {/* Playhead handle */}
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-3 h-6 bg-white border-2 border-blue-500 rounded-sm shadow-md" />
          </div>
        </div>

        {/* Frame markers */}
        {showFrameMarkers && frameCount > 0 && (
          <div className="absolute -bottom-3 left-0 right-0 h-2">
            {Array.from({ length: frameCount }, (_, index) => (
              <div
                key={index}
                className={`absolute top-0 w-0.5 h-2 cursor-pointer transition-colors ${
                  index === currentFrame ? 'bg-yellow-400' : 'bg-gray-300 hover:bg-gray-400'
                }`}
                style={{
                  left: frameCount > 1 ? `${(index / (frameCount - 1)) * 100}%` : '0%'
                }}
                onClick={() => handleFrameClick(index)}
                title={`Frame ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Current time display */}
      <div className="flex justify-between items-center text-sm">
        <div className="text-gray-600">
          {formatTime(currentTime)}
          {frameCount > 0 && ` (Frame ${currentFrame + 1}/${frameCount})`}
        </div>
        <div className="text-gray-500 text-xs">
          {onAddMarker && 'Ctrl+Click to add feedback marker'}
        </div>
      </div>

      {/* Feedback marker legend */}
      {feedbackMarkers.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
            <span>Shape</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm" />
            <span>Location</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-purple-500 rounded-sm" />
            <span>Movement</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-500 rounded-sm" />
            <span>General</span>
          </div>
        </div>
      )}

      {/* Tooltip for hovered marker */}
      {hoveredMarker && (
        <div
          className="fixed z-50 bg-black text-white text-sm p-2 rounded shadow-lg pointer-events-none max-w-xs"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10
          }}
        >
          <div className="font-medium capitalize">{hoveredMarker.category} Feedback</div>
          <div className="text-gray-300">{formatTime(hoveredMarker.timestamp)}</div>
          <div className="mt-1">{hoveredMarker.content}</div>
          <div className={`text-xs mt-1 ${
            hoveredMarker.severity === 'high' ? 'text-red-300' :
            hoveredMarker.severity === 'medium' ? 'text-yellow-300' :
            'text-green-300'
          }`}>
            {hoveredMarker.severity.toUpperCase()} priority
          </div>
        </div>
      )}
    </div>
  );
};
