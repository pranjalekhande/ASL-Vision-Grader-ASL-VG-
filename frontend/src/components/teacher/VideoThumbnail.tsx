import React, { useState, useEffect, useRef } from 'react';
import { thumbnailCache } from '../../utils/thumbnailGenerator';
import { calculateOverallScore, categorizeScore, formatScore } from '../../utils/scoreCalculation';
import { VideoHoverPreview } from './VideoHoverPreview';

interface VideoThumbnailProps {
  attempt: {
    id: string;
    video_url: string | null;
    student_name?: string;
    sign_name: string;
    score_shape: number | null;
    score_location: number | null;
    score_movement: number | null;
    created_at: string;
    landmarks?: any;
    feedback_count?: number;
  };
  onClick: (attempt: any) => void;
  showLandmarks?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  attempt,
  onClick,
  showLandmarks = false,
  size = 'medium'
}) => {
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [showPreview, setShowPreview] = useState(false);
  
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();
  const previewDelayRef = useRef<NodeJS.Timeout>();
  const lastMouseLeaveAtRef = useRef<number>(0);
  const hoverStartedAtRef = useRef<number>(0);
  const isOverPreviewRef = useRef<boolean>(false);

  // Size configurations
  const sizeConfig = {
    small: { width: 160, height: 120, titleSize: 'text-xs', badgeSize: 'text-xs px-1 py-0.5' },
    medium: { width: 200, height: 150, titleSize: 'text-sm', badgeSize: 'text-xs px-2 py-1' },
    large: { width: 240, height: 180, titleSize: 'text-base', badgeSize: 'text-sm px-2 py-1' }
  };

  const config = sizeConfig[size];
  const overallScore = calculateOverallScore(attempt);
  const scoreCategory = categorizeScore(overallScore);

  // Generate thumbnail on mount
  useEffect(() => {
    const generateThumbnail = async () => {
      if (!attempt.video_url) {
        setIsLoading(false);
        setThumbnailError(true);
        return;
      }

      try {
        setIsLoading(true);
        setThumbnailError(false);
        
        const result = await thumbnailCache.get(attempt.video_url, {
          width: config.width,
          height: config.height,
          timeSeconds: 2
        });
        
        setThumbnailUrl(result.dataUrl);
      } catch (error) {
        console.warn('Failed to generate thumbnail:', error);
        setThumbnailError(true);
      } finally {
        setIsLoading(false);
      }
    };

    generateThumbnail();
  }, [attempt.video_url, config.width, config.height]);

  // Validate video URL
  const isValidVideoUrl = (url: string | null): boolean => {
    if (!url || url.trim() === '') return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Handle mouse enter
  const handleMouseEnter = () => {
    console.log('🖱️ HOVER START:', {
      attemptId: attempt.id,
      videoUrl: attempt.video_url,
      signName: attempt.sign_name,
      studentName: attempt.student_name,
      hasValidUrl: isValidVideoUrl(attempt.video_url)
    });
    
    setIsHovering(true);
    hoverStartedAtRef.current = Date.now();
    
    // Update hover position
    const rect = thumbnailRef.current?.getBoundingClientRect();
    if (rect) {
      const position = {
        x: rect.right + 10,
        y: rect.top
      };
      setHoverPosition(position);
      console.log('📍 Hover position set:', position);
    }

    // Clear any existing timeouts
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      console.log('🧹 Cleared hover timeout');
    }
    if (previewDelayRef.current) {
      clearTimeout(previewDelayRef.current);
      console.log('🧹 Cleared preview delay timeout');
    }

    // Show preview after delay (only if there's a valid video URL)
    if (attempt.video_url && isValidVideoUrl(attempt.video_url)) {
      console.log('⏱️ Setting preview delay for:', attempt.video_url);
      previewDelayRef.current = setTimeout(() => {
        const now = Date.now();
        const leftAgoMs = lastMouseLeaveAtRef.current ? now - lastMouseLeaveAtRef.current : -1;
        const withinLeaveGrace = leftAgoMs >= 0 && leftAgoMs <= 500; // grace after leaving
        const enteredAgoMs = hoverStartedAtRef.current ? now - hoverStartedAtRef.current : -1;
        const withinEnterGrace = enteredAgoMs >= 0 && enteredAgoMs <= 350; // show even if user left quickly
        console.log('⏰ Preview delay timeout fired:', { isHovering, withinLeaveGrace, leftAgoMs, withinEnterGrace, enteredAgoMs });
        // Show if still hovering, or left very recently, or entered very recently
        if (isHovering || withinLeaveGrace || withinEnterGrace) {
          console.log('✅ Showing preview for:', attempt.video_url);
          setShowPreview(true);
        } else {
          console.log('❌ Not showing preview - failed grace checks');
        }
      }, 200); // Reduced to 200ms for faster response
    } else {
      console.log('❌ Cannot show preview:', {
        hasUrl: !!attempt.video_url,
        isValid: attempt.video_url ? isValidVideoUrl(attempt.video_url) : false,
        url: attempt.video_url
      });
    }
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    console.log('🖱️ HOVER END:', {
      attemptId: attempt.id,
      wasShowingPreview: showPreview,
      isCurrentlyHovering: isHovering
    });
    
    setIsHovering(false);
    lastMouseLeaveAtRef.current = Date.now();
    
    // Clear timeout
    if (previewDelayRef.current) {
      clearTimeout(previewDelayRef.current);
      console.log('🧹 Cleared preview delay on mouse leave');
    }

    // Hide preview with delay to allow moving to preview
    console.log('⏱️ Setting hide preview timeout (500ms)');
    hoverTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Hide preview timeout fired');
      if (!isOverPreviewRef.current) {
        setShowPreview(false);
      } else {
        console.log('🛑 Not hiding preview - mouse over preview');
      }
    }, 500); // Increased to 500ms to give time to move to preview
  };

  // Handle click
  const handleClick = () => {
    onClick(attempt);
  };

  // Close preview
  const handleClosePreview = () => {
    console.log('❌ CLOSE PREVIEW:', attempt.id);
    setShowPreview(false);
    setIsHovering(false);
  };

  // Preview window hover handlers (passed to preview component)
  const handlePreviewMouseEnter = () => {
    console.log('🖱️ ENTER PREVIEW (from thumbnail handler)');
    isOverPreviewRef.current = true;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      console.log('🧹 Cleared hide timeout on preview enter');
    }
    // Ensure preview remains visible
    setShowPreview(true);
  };

  const handlePreviewMouseLeave = () => {
    console.log('🖱️ LEAVE PREVIEW (from thumbnail handler)');
    isOverPreviewRef.current = false;
    // Start a short timeout to hide after leaving preview
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHovering && !isOverPreviewRef.current) {
        console.log('⏰ Hiding preview after leaving preview area');
        setShowPreview(false);
      }
    }, 250);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div
        ref={thumbnailRef}
        className={`relative bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-105 ${
          isHovering ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
        }`}
        style={{ width: config.width }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* Thumbnail Image */}
        <div 
          className="relative bg-gray-900 rounded-t-lg overflow-hidden"
          style={{ height: config.height }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}
          
          {thumbnailError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <p className="text-xs">No preview</p>
              </div>
            </div>
          )}
          
          {thumbnailUrl && !isLoading && (
            <img 
              src={thumbnailUrl} 
              alt={`${attempt.sign_name} thumbnail`}
              className="w-full h-full object-cover"
            />
          )}

          {/* Score badge */}
          {overallScore !== null && (
            <div className="absolute top-2 right-2">
              <span className={`inline-flex items-center ${config.badgeSize} font-medium rounded-full ${scoreCategory.color}`}>
                {formatScore(overallScore)}
              </span>
            </div>
          )}

          {/* Feedback indicator */}
          {(attempt.feedback_count || 0) > 0 && (
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center text-xs px-2 py-1 font-medium rounded-full bg-orange-100 text-orange-800">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                {attempt.feedback_count}
              </span>
            </div>
          )}

          {/* Video duration overlay */}
          <div className="absolute bottom-2 right-2">
            <span className="text-xs text-white bg-black bg-opacity-50 px-1 py-0.5 rounded">
              ~7s
            </span>
          </div>

          {/* Play icon overlay on hover */}
          {isHovering && attempt.video_url && isValidVideoUrl(attempt.video_url) && (
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
              <div className="bg-white bg-opacity-90 rounded-full p-3">
                <svg className="w-6 h-6 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="p-3">
          {/* Sign name */}
          <h3 className={`font-semibold text-gray-900 ${config.titleSize} mb-1 truncate`}>
            {attempt.sign_name}
          </h3>

          {/* Student name */}
          {attempt.student_name && (
            <p className="text-gray-600 text-xs mb-2 truncate">
              {attempt.student_name}
            </p>
          )}

          {/* Date and scores */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{formatDate(attempt.created_at)}</span>
            {overallScore !== null && (
              <div className="flex space-x-1">
                <span className="text-blue-600">{formatScore(attempt.score_shape)}</span>
                <span className="text-green-600">{formatScore(attempt.score_location)}</span>
                <span className="text-purple-600">{formatScore(attempt.score_movement)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Hover indicator */}
        {isHovering && (
          <div className="absolute inset-0 ring-2 ring-blue-500 ring-opacity-50 rounded-lg pointer-events-none"></div>
        )}
        
        {/* Preview loading indicator */}
        {isHovering && !showPreview && attempt.video_url && isValidVideoUrl(attempt.video_url) && (
          <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
            Loading preview...
          </div>
        )}
      </div>

      {/* Hover Preview */}
      {showPreview && attempt.video_url && isValidVideoUrl(attempt.video_url) && (
        <VideoHoverPreview
          videoUrl={attempt.video_url}
          isVisible={showPreview}
          position={hoverPosition}
          landmarks={showLandmarks ? attempt.landmarks?.frames : []}
          showLandmarks={showLandmarks}
          onClose={handleClosePreview}
          onMouseEnterPreview={handlePreviewMouseEnter}
          onMouseLeavePreview={handlePreviewMouseLeave}
        />
      )}
    </>
  );
};
