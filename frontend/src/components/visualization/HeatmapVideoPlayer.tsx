import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { HandLandmarkFrame } from '../../types/landmarks';

interface HeatmapVideoPlayerProps {
  videoUrl: string;
  heatmapData: Array<{ frameIndex: number; differences: number[] }>;
  landmarkData?: HandLandmarkFrame[];
  showLandmarks?: boolean;
  className?: string;
}

export function HeatmapVideoPlayer({
  videoUrl,
  heatmapData,
  landmarkData,
  showLandmarks = true,
  className = ''
}: HeatmapVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);

  // Hand landmark connections for drawing hand skeleton
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
    // Palm
    [5, 9], [9, 13], [13, 17]
  ];

  // Calculate frame index based on video time
  const getFrameIndex = useCallback((time: number, videoDuration: number, totalFrames: number) => {
    if (videoDuration === 0 || totalFrames === 0) return 0;
    const progress = time / videoDuration;
    return Math.floor(progress * totalFrames);
  }, []);

  // Get color based on heatmap difference value
  const getHeatmapColor = useCallback((difference: number) => {
    // Normalize difference to 0-1 range (assuming max difference is around 0.2)
    const normalized = Math.min(difference / 0.2, 1);
    
    if (normalized < 0.2) {
      // Green for good accuracy
      return `rgba(34, 197, 94, ${0.3 + normalized * 0.4})`;
    } else if (normalized < 0.5) {
      // Yellow for moderate accuracy
      return `rgba(234, 179, 8, ${0.3 + normalized * 0.4})`;
    } else {
      // Red for poor accuracy
      return `rgba(239, 68, 68, ${0.3 + normalized * 0.4})`;
    }
  }, []);

  // Draw landmarks and heatmap on canvas
  const drawVisualization = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get current frame data
    const frameIndex = getFrameIndex(currentTime, duration, heatmapData.length);
    const heatmapFrame = heatmapData[frameIndex];
    const landmarkFrame = landmarkData?.[frameIndex];

    if (!heatmapFrame && !landmarkFrame) return;

    // Set canvas dimensions to match video display size
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Calculate scale factors
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    // Draw landmarks if available
    if (showLandmarks && landmarkFrame?.landmarks?.[0]) {
      const landmarks = landmarkFrame.landmarks[0];
      
      // Draw connections first (behind landmarks)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      HAND_CONNECTIONS.forEach(([start, end]) => {
        if (landmarks[start] && landmarks[end]) {
          const startX = landmarks[start].x * canvas.width;
          const startY = landmarks[start].y * canvas.height;
          const endX = landmarks[end].x * canvas.width;
          const endY = landmarks[end].y * canvas.height;
          
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
        }
      });
      ctx.stroke();

      // Draw landmarks with heatmap colors
      landmarks.forEach((landmark, index) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        // Get heatmap color for this landmark
        let color = 'rgba(255, 255, 255, 0.8)'; // Default white
        if (heatmapFrame?.differences?.[index] !== undefined) {
          color = getHeatmapColor(heatmapFrame.differences[index]);
        }

        // Draw landmark point
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Draw overall accuracy indicator
    if (heatmapFrame?.differences) {
      const avgDifference = heatmapFrame.differences.reduce((sum, diff) => sum + diff, 0) / heatmapFrame.differences.length;
      const accuracy = Math.max(0, 100 - (avgDifference * 500)); // Scale to percentage
      
      // Draw accuracy badge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 120, 30);
      
      ctx.fillStyle = accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444';
      ctx.font = '14px Arial';
      ctx.fillText(`Accuracy: ${Math.round(accuracy)}%`, 15, 30);
    }
  }, [currentTime, duration, heatmapData, landmarkData, showLandmarks, getFrameIndex, getHeatmapColor]);

  // Handle video time updates
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
      const newFrame = getFrameIndex(video.currentTime, video.duration, heatmapData.length);
      setCurrentFrame(newFrame);
    }
  }, [heatmapData.length, getFrameIndex]);

  // Setup video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [handleTimeUpdate]);

  // Redraw visualization when data changes
  useEffect(() => {
    drawVisualization();
  }, [drawVisualization]);

  // Handle play/pause
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  // Handle seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = (parseFloat(e.target.value) / 100) * duration;
    video.currentTime = time;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Video Container */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto"
          style={{ maxHeight: '400px' }}
        />
        
        {/* Overlay Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ 
            width: '100%', 
            height: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        {/* Progress Bar */}
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500 w-12">
            {Math.floor(currentTime)}s
          </span>
          <input
            type="range"
            min="0"
            max="100"
            value={duration > 0 ? (currentTime / duration) * 100 : 0}
            onChange={handleSeek}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-500 w-12">
            {Math.floor(duration)}s
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={togglePlayback}
            className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Frame Info */}
        <div className="text-center text-sm text-gray-600">
          Frame {currentFrame + 1} of {heatmapData.length}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded-full opacity-60"></div>
          <span>Good Accuracy</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-yellow-500 rounded-full opacity-60"></div>
          <span>Moderate</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded-full opacity-60"></div>
          <span>Needs Work</span>
        </div>
      </div>
    </div>
  );
}
