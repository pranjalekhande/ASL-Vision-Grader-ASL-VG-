/**
 * Video Thumbnail Generator Utility
 * Extracts frames from videos to create thumbnail images
 */

export interface ThumbnailOptions {
  timeSeconds?: number;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ThumbnailResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Generate thumbnail from video URL
 */
export const generateVideoThumbnail = async (
  videoUrl: string, 
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult> => {
  // Validate URL first
  if (!videoUrl || videoUrl.trim() === '') {
    throw new Error('Video URL is required');
  }

  try {
    new URL(videoUrl);
  } catch {
    throw new Error('Invalid video URL format');
  }

  const {
    timeSeconds = 2,
    width = 200,
    height = 150,
    quality = 0.8,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.playsInline = true;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    const cleanup = () => {
      video.remove();
      canvas.remove();
    };

    video.onloadedmetadata = () => {
      // Ensure we don't seek beyond video duration
      const seekTime = Math.min(timeSeconds, video.duration - 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        // Calculate aspect ratio and positioning
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = width / height;
        
        let drawWidth = width;
        let drawHeight = height;
        let drawX = 0;
        let drawY = 0;

        if (videoAspect > canvasAspect) {
          // Video is wider - fit by height
          drawHeight = height;
          drawWidth = height * videoAspect;
          drawX = (width - drawWidth) / 2;
        } else {
          // Video is taller - fit by width
          drawWidth = width;
          drawHeight = width / videoAspect;
          drawY = (height - drawHeight) / 2;
        }

        // Clear canvas with black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Draw video frame
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);

        // Convert to blob and data URL
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error('Failed to create blob'));
              return;
            }

            const dataUrl = canvas.toDataURL(`image/${format}`, quality);
            
            cleanup();
            resolve({
              dataUrl,
              blob,
              width,
              height,
              timestamp: video.currentTime
            });
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video'));
    };

    video.ontimeupdate = () => {
      // Sometimes seeked doesn't fire, so we use timeupdate as backup
      if (Math.abs(video.currentTime - timeSeconds) < 0.1) {
        video.ontimeupdate = null; // Prevent multiple calls
        if (video.onseeked) {
          video.onseeked(new Event('seeked'));
        }
      }
    };

    // Load the video
    video.src = videoUrl;
    video.load();
  });
};

/**
 * Thumbnail cache management
 */
class ThumbnailCache {
  private cache = new Map<string, ThumbnailResult>();
  private maxSize = 100; // Maximum number of cached thumbnails

  private generateCacheKey(videoUrl: string, options: ThumbnailOptions): string {
    const key = `${videoUrl}_${options.timeSeconds || 2}_${options.width || 200}_${options.height || 150}`;
    return btoa(key).replace(/[/+=]/g, ''); // Base64 encode and clean
  }

  async get(videoUrl: string, options: ThumbnailOptions = {}): Promise<ThumbnailResult> {
    const cacheKey = this.generateCacheKey(videoUrl, options);
    
    // Check memory cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Check localStorage cache
    try {
      const stored = localStorage.getItem(`thumbnail_${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const result: ThumbnailResult = {
          dataUrl: parsed.dataUrl,
          blob: new Blob(), // We don't store blobs in localStorage
          width: parsed.width,
          height: parsed.height,
          timestamp: parsed.timestamp
        };
        this.cache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn('Failed to load thumbnail from cache:', error);
    }

    // Generate new thumbnail
    const result = await generateVideoThumbnail(videoUrl, options);
    
    // Store in memory cache
    this.cache.set(cacheKey, result);
    
    // Store in localStorage (without blob to save space)
    try {
      const toStore = {
        dataUrl: result.dataUrl,
        width: result.width,
        height: result.height,
        timestamp: result.timestamp
      };
      localStorage.setItem(`thumbnail_${cacheKey}`, JSON.stringify(toStore));
    } catch (error) {
      console.warn('Failed to cache thumbnail:', error);
    }

    // Cleanup old cache entries if needed
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    return result;
  }

  clear(): void {
    this.cache.clear();
    // Clear localStorage thumbnails
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('thumbnail_')) {
        localStorage.removeItem(key);
      }
    }
  }

  getSize(): number {
    return this.cache.size;
  }
}

export const thumbnailCache = new ThumbnailCache();

/**
 * Generate multiple thumbnails at different timestamps
 */
export const generateVideoTimeline = async (
  videoUrl: string,
  count: number = 5,
  options: Omit<ThumbnailOptions, 'timeSeconds'> = {}
): Promise<ThumbnailResult[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const interval = duration / (count + 1); // Add 1 to avoid taking thumbnail at very end
      const thumbnails: ThumbnailResult[] = [];

      try {
        for (let i = 1; i <= count; i++) {
          const timeSeconds = interval * i;
          const thumbnail = await generateVideoThumbnail(videoUrl, {
            ...options,
            timeSeconds
          });
          thumbnails.push(thumbnail);
        }
        
        video.remove();
        resolve(thumbnails);
      } catch (error) {
        video.remove();
        reject(error);
      }
    };

    video.onerror = () => {
      video.remove();
      reject(new Error('Failed to load video for timeline generation'));
    };

    video.src = videoUrl;
    video.load();
  });
};

/**
 * Preload thumbnails for better UX
 */
export const preloadThumbnails = async (
  videoUrls: string[],
  options: ThumbnailOptions = {}
): Promise<void> => {
  const promises = videoUrls.filter(Boolean).map(url => 
    thumbnailCache.get(url, options).catch(error => {
      console.warn(`Failed to preload thumbnail for ${url}:`, error);
      return null;
    })
  );

  await Promise.allSettled(promises);
};
