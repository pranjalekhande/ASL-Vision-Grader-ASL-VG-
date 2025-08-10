import React, { useRef, useEffect, useState } from 'react';

interface VideoHoverPreviewProps {
  videoUrl: string;
  isVisible: boolean;
  position: { x: number; y: number };
  landmarks?: any[];
  showLandmarks?: boolean;
  onClose?: () => void;
  onMouseEnterPreview?: () => void;
  onMouseLeavePreview?: () => void;
}

export const VideoHoverPreview: React.FC<VideoHoverPreviewProps> = ({
  videoUrl,
  isVisible,
  position,
  landmarks = [],
  showLandmarks = false,
  onClose,
  onMouseEnterPreview,
  onMouseLeavePreview
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [calculatedPosition, setCalculatedPosition] = useState(position);

  // Calculate smart positioning to avoid viewport edges
  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newX = position.x;
    let newY = position.y;

    // Adjust horizontal position
    if (position.x + rect.width > viewportWidth - 20) {
      newX = position.x - rect.width - 20;
    }

    // Adjust vertical position
    if (position.y + rect.height > viewportHeight - 20) {
      newY = position.y - rect.height - 20;
    }

    // Ensure minimum distance from edges
    newX = Math.max(20, newX);
    newY = Math.max(20, newY);

    setCalculatedPosition({ x: newX, y: newY });
  }, [position, isVisible]);



  // Handle video loading and playback
  useEffect(() => {
    console.log('🎬 VIDEO PREVIEW MOUNT:', {
      isVisible,
      videoUrl,
      hasVideoRef: !!videoRef.current
    });
    
    const video = videoRef.current;
    if (!video || !isVisible || !videoUrl) {
      console.log('❌ Video preview setup failed:', {
        hasVideo: !!video,
        isVisible,
        hasVideoUrl: !!videoUrl
      });
      return;
    }

    // Validate URL before proceeding
    try {
      new URL(videoUrl);
      console.log('✅ Video URL is valid:', videoUrl);
    } catch (error) {
      console.warn('❌ Invalid video URL:', videoUrl);
      setIsLoaded(false);
      return;
    }

    // Reset states
    console.log('🔄 Resetting video states');
    setIsLoaded(false);
    setIsPlaying(false);

    const handleCanPlay = () => {
      console.log('🎯 VIDEO CAN PLAY:', videoUrl);
      setIsLoaded(true);
      
      // Simple auto-play attempt
      setTimeout(() => {
        console.log('⏰ Auto-play timeout fired:', {
          hasVideo: !!video,
          isPaused: video?.paused,
          isVisible,
          readyState: video?.readyState
        });
        
        if (video && video.paused && isVisible) {
          console.log('🎮 Attempting to play video:', videoUrl);
          video.play().then(() => {
            console.log('✅ Auto-play SUCCESS for:', videoUrl);
          }).catch((error) => {
            console.log('❌ Auto-play blocked for:', videoUrl, '(this is normal behavior)', error.name);
          });
        } else {
          console.log('⏸️ Not attempting play:', {
            hasVideo: !!video,
            isPaused: video?.paused,
            isVisible
          });
        }
      }, 200);
    };

    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded:', videoUrl);
    };

    const handlePlay = () => {
      console.log('▶️ VIDEO STARTED PLAYING:', videoUrl);
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('⏸️ VIDEO PAUSED:', videoUrl);
      setIsPlaying(false);
    };

    const handleError = (event: Event) => {
      const target = event.target as HTMLVideoElement;
      let errorMessage = 'Unknown error';
      
      if (target.error) {
        switch (target.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Video loading aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Video decode error';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported or file not found';
            break;
        }
      }
      
      console.warn('Video preview failed to load:', {
        url: videoUrl,
        error: errorMessage,
        mediaError: target.error,
        networkState: target.networkState,
        readyState: target.readyState
      });
      setIsLoaded(false);
    };

    const handleAbort = () => {
      console.log('Video loading aborted for:', videoUrl);
      setIsLoaded(false);
    };

    const handleEmptied = () => {
      console.log('Video emptied for:', videoUrl);
      setIsLoaded(false);
      setIsPlaying(false);
    };

    // Add all event listeners before setting src
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);
    video.addEventListener('abort', handleAbort);
    video.addEventListener('emptied', handleEmptied);

    // Properly clear any previous src and load new video
    console.log('🧹 Clearing previous video source');
    video.removeAttribute('src');
    video.load(); // This clears the current source
    
    // Set new source after a brief delay to ensure clean state
    setTimeout(() => {
      if (video && videoUrl) {
        console.log('🔗 Setting video source:', videoUrl);
        video.src = videoUrl;
        video.load();
        console.log('🔄 Video.load() called');
      }
    }, 10);

    return () => {
      // Clean up all event listeners
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      video.removeEventListener('abort', handleAbort);
      video.removeEventListener('emptied', handleEmptied);
      
      // Properly clean up video
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [videoUrl, isVisible]);

  // Handle landmark overlay drawing
  useEffect(() => {
    if (!showLandmarks || !landmarks.length || !isPlaying) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawLandmarks = () => {
      if (video.paused || video.ended) return;

      // Calculate current frame based on video time
      const currentTime = video.currentTime;
      const frameRate = landmarks.length / video.duration;
      const currentFrame = Math.floor(currentTime * frameRate);
      
      if (currentFrame >= 0 && currentFrame < landmarks.length) {
        const frame = landmarks[currentFrame];
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw landmarks if available
        if (frame && frame.landmarks) {
          ctx.fillStyle = '#00ff00';
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          
          // Draw hand landmarks
          frame.landmarks.forEach((landmark: any) => {
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
          });
        }
      }

      requestAnimationFrame(drawLandmarks);
    };

    drawLandmarks();
  }, [landmarks, showLandmarks, isPlaying]);

  // Reset state when visibility changes
  useEffect(() => {
    if (!isVisible) {
      setIsLoaded(false);
      setIsPlaying(false);
    }
  }, [isVisible]);

  if (!isVisible) {
    console.log('👻 Preview not visible, not rendering');
    return null;
  }

  console.log('🎬 RENDERING VIDEO PREVIEW:', {
    videoUrl,
    isLoaded,
    isPlaying,
    position: calculatedPosition
  });

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black bg-opacity-20"
        onClick={onClose}
      />
      
      {/* Preview Container */}
      <div
        ref={containerRef}
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
        style={{
          left: calculatedPosition.x,
          top: calculatedPosition.y,
          width: '320px',
          height: '240px'
        }}
        onMouseEnter={() => {
          console.log('🖱️ Mouse entered preview window');
          onMouseEnterPreview?.();
        }}
        onMouseLeave={() => {
          console.log('🖱️ Mouse left preview window');
          onMouseLeavePreview?.();
        }}
      >
        {/* Header */}
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Preview</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Video Container */}
        <div className="relative bg-black" style={{ height: '180px' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            controls={false}
            crossOrigin="anonymous"
          />

          {/* Landmark overlay */}
          {showLandmarks && (
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              width={320}
              height={180}
            />
          )}

          {/* Loading indicator */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            </div>
          )}

          {/* Click to play overlay */}
          {isLoaded && !isPlaying && (
            <div 
              className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center cursor-pointer hover:bg-opacity-40 transition-all"
              onClick={() => {
                const video = videoRef.current;
                if (video) {
                  video.play().catch(error => {
                    console.warn('Manual play failed:', error);
                  });
                }
              }}
            >
              <div className="bg-white bg-opacity-90 rounded-full p-4 hover:bg-opacity-100 transition-all">
                <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                Click to play
              </div>
            </div>
          )}

          {/* Play/Pause indicator */}
          <div className="absolute bottom-2 right-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-opacity ${
              isLoaded && isPlaying ? 'bg-black bg-opacity-50' : 'opacity-0'
            }`}>
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Error state */}
          {!isLoaded && videoRef.current?.error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-sm">
              <div className="text-center">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p>Preview unavailable</p>
              </div>
            </div>
          )}
        </div>

        {/* Mini controls */}
        <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {showLandmarks ? 'With landmarks' : 'Video only'}
            </span>
            <span>
              {isLoaded ? 'Playing preview' : 'Loading...'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
