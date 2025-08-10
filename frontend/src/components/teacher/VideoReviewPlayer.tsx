import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LandmarkViewer } from '../landmarks/LandmarkViewer';
import type { HandLandmarkFrame } from '../../types/landmarks';

interface VideoReviewPlayerProps {
  videoUrl: string;
  landmarks?: HandLandmarkFrame[];
  width?: number;
  height?: number;
  onFrameChange?: (frameIndex: number, timestamp: number) => void;
  showLandmarks?: boolean;
  playbackSpeed?: number;
}

export const VideoReviewPlayer: React.FC<VideoReviewPlayerProps> = ({
  videoUrl,
  landmarks = [],
  width = 640,
  height = 480,
  onFrameChange,
  showLandmarks = true,
  playbackSpeed = 1.0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [speed, setSpeed] = useState(playbackSpeed);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Frame navigation
  const totalFrames = landmarks.length;
  const frameRate = totalFrames > 0 && duration > 0 ? totalFrames / duration : 30;

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      video.playbackRate = speed;
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(video.currentTime);
        
        // Calculate current frame based on timestamp
        if (landmarks.length > 0) {
          const frameIndex = Math.floor((video.currentTime / duration) * landmarks.length);
          const clampedIndex = Math.max(0, Math.min(frameIndex, landmarks.length - 1));
          setCurrentFrame(clampedIndex);
          onFrameChange?.(clampedIndex, video.currentTime);
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [isDragging, duration, landmarks.length, onFrameChange, speed]);

  // Update playback speed
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = speed;
    }
  }, [speed]);

  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  // Frame-by-frame navigation
  const goToFrame = useCallback((frameIndex: number) => {
    if (landmarks.length === 0 || !duration) return;
    
    const targetTime = (frameIndex / landmarks.length) * duration;
    seekTo(targetTime);
    setCurrentFrame(frameIndex);
    onFrameChange?.(frameIndex, targetTime);
  }, [landmarks.length, duration, seekTo, onFrameChange]);

  const nextFrame = useCallback(() => {
    if (currentFrame < totalFrames - 1) {
      goToFrame(currentFrame + 1);
    }
  }, [currentFrame, totalFrames, goToFrame]);

  const prevFrame = useCallback(() => {
    if (currentFrame > 0) {
      goToFrame(currentFrame - 1);
    }
  }, [currentFrame, goToFrame]);

  // Timeline scrubbing
  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    const timeline = timelineRef.current;
    if (!timeline || !duration) return;

    const rect = timeline.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    seekTo(newTime);
  }, [duration, seekTo]);

  const handleTimelineDrag = useCallback((event: React.MouseEvent) => {
    if (!isDragging) return;
    handleTimelineClick(event);
  }, [isDragging, handleTimelineClick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          prevFrame();
          break;
        case 'ArrowRight':
          event.preventDefault();
          nextFrame();
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSpeed(prev => Math.min(prev + 0.25, 2));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setSpeed(prev => Math.max(prev - 0.25, 0.25));
          break;
        case 'm':
          event.preventDefault();
          setIsMuted(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [togglePlayPause, nextFrame, prevFrame]);

  // Volume control
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Draw landmarks on canvas
  const drawLandmarks = useCallback(() => {
    if (!canvasRef.current || !showLandmarks || landmarks.length === 0) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get current landmark frame
    const landmarkFrame = landmarks[currentFrame];
    if (!landmarkFrame?.landmarks) return;

    // Draw landmarks for each hand
    landmarkFrame.landmarks.forEach((handLandmarks) => {
      handLandmarks.forEach((landmark, index) => {
        if (landmark.visibility && landmark.visibility < 0.5) return;

        // Draw landmark point
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#00FF00';
        ctx.fill();

        // Draw connections (simplified)
        if (index > 0) {
          const prevLandmark = handLandmarks[index - 1];
          ctx.beginPath();
          ctx.moveTo(prevLandmark.x * width, prevLandmark.y * height);
          ctx.lineTo(landmark.x * width, landmark.y * height);
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    });
  }, [showLandmarks, landmarks, currentFrame, width, height]);

  // Update landmark visualization when frame changes
  useEffect(() => {
    drawLandmarks();
  }, [drawLandmarks]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col space-y-4 max-w-full">
      {/* Video Container */}
      <div className="relative bg-black rounded-lg overflow-hidden max-w-full">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto"
          width={width}
          height={height}
          preload="metadata"
        />
        
        {/* Landmark overlay */}
        {showLandmarks && (
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            width={width}
            height={height}
          />
        )}

        {/* Loading indicator */}
        {duration === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 text-white p-4 rounded-lg max-w-full overflow-hidden">
        {/* Main controls row */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
              disabled={duration === 0}
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {/* Frame navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={prevFrame}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                disabled={currentFrame === 0}
                title="Previous frame (←)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              <button
                onClick={nextFrame}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                disabled={currentFrame === totalFrames - 1}
                title="Next frame (→)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414zm6 0a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L14.586 10l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Time display */}
            <div className="text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Frame counter */}
            {landmarks.length > 0 && (
              <div className="text-sm text-gray-300">
                Frame: {currentFrame + 1} / {totalFrames}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 flex-wrap">
            {/* Speed control */}
            <div className="flex items-center space-x-2">
              <span className="text-sm">Speed:</span>
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="bg-gray-700 text-white text-sm rounded px-2 py-1"
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>

            {/* Volume control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  {isMuted ? (
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zm7.823 1.073a1 1 0 011.414 1.414L16.414 7.77 18.62 9.976a1 1 0 11-1.414 1.414L15 9.184l-2.206 2.206a1 1 0 01-1.414-1.414L13.586 7.77 11.38 5.564a1 1 0 011.414-1.414L15 6.356l2.206-2.206z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM12 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm4-1a1 1 0 011 1v2a1 1 0 11-2 0V8a1 1 0 011-1z" clipRule="evenodd" />
                  )}
                </svg>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-16"
              />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-2 w-full">
          <div
            ref={timelineRef}
            className="relative h-4 bg-gray-600 rounded-full cursor-pointer"
            onClick={handleTimelineClick}
            onMouseMove={handleTimelineDrag}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            {/* Progress bar */}
            <div
              className="absolute left-0 top-0 h-full bg-blue-600 rounded-full transition-all duration-100"
              style={{
                width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
              }}
            />
            
            {/* Playhead */}
            <div
              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
              style={{
                left: duration > 0 ? `calc(${(currentTime / duration) * 100}% - 8px)` : '0px'
              }}
            />
          </div>

          {/* Frame markers */}
          {landmarks.length > 0 && (
            <div className="relative h-2">
              {landmarks.map((_, index) => (
                <div
                  key={index}
                  className={`absolute top-0 w-1 h-full cursor-pointer transition-colors ${
                    index === currentFrame ? 'bg-yellow-400' : 'bg-gray-400'
                  }`}
                  style={{
                    left: `${(index / landmarks.length) * 100}%`
                  }}
                  onClick={() => goToFrame(index)}
                  title={`Frame ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Keyboard shortcuts help */}
        <div className="text-xs text-gray-400 mt-2 break-words">
          <span className="hidden sm:inline">Shortcuts: Space/K (play/pause), ←/→ (frame nav), ↑/↓ (speed), M (mute)</span>
          <span className="sm:hidden">Shortcuts: Spacebar (play/pause), ←/→ (frame), ↑/↓ (speed), M (mute)</span>
        </div>
      </div>
    </div>
  );
};
