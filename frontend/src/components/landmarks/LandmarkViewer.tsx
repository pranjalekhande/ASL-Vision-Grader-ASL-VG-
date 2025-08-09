import { useState, useEffect } from 'react';
import type { RecordingData } from '../../types/landmarks';
import { UploadService } from '../../services/uploadService';

interface Props {
  landmarkUrl: string;
  width?: number;
  height?: number;
}

export function LandmarkViewer({ landmarkUrl, width = 400, height = 300 }: Props) {
  const [data, setData] = useState<RecordingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const landmarkData = await UploadService.getLandmarkData(landmarkUrl);
        setData(landmarkData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load landmark data');
        setData(null);
      }
    };

    fetchData();
  }, [landmarkUrl]);

  useEffect(() => {
    let animationFrame: number;

    const animate = () => {
      if (isPlaying && data) {
        setCurrentFrame(prev => (prev + 1) % data.frames.length);
        animationFrame = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      animationFrame = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, data]);

  const drawFrame = (ctx: CanvasRenderingContext2D, frameIndex: number) => {
    if (!data || !data.frames[frameIndex]) {
      console.log('No frame data available:', { frameIndex, hasData: !!data });
      return;
    }

    // Clear and set background
    ctx.fillStyle = '#1a1a1a'; // Dark background
    ctx.fillRect(0, 0, width, height);
    
    const frame = data.frames[frameIndex];
    console.log('Drawing frame:', { 
      frameIndex, 
      hands: frame.landmarks.length,
      timestamp: frame.timestamp 
    });

    frame.landmarks.forEach(handLandmarks => {
      handLandmarks.forEach((landmark, index) => {
        // Draw landmark point
        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#4ade80'; // Softer green
        ctx.fill();

        // Draw connections
        if (index > 0) {
          const prevLandmark = handLandmarks[index - 1];
          ctx.beginPath();
          ctx.moveTo(prevLandmark.x * width, prevLandmark.y * height);
          ctx.lineTo(landmark.x * width, landmark.y * height);
          ctx.strokeStyle = '#4ade80'; // Softer green
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
    });
  };

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    if (!ctx || !data) return;

    drawFrame(ctx, currentFrame);
  }, [currentFrame, data, width, height, drawFrame]);

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 rounded-lg">
        Error: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-lg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <canvas
        width={width}
        height={height}
        className="bg-gray-900 rounded-lg"
      />
      
      <div className="flex items-center justify-between">
        <div className="space-x-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => setCurrentFrame(prev => 
              prev > 0 ? prev - 1 : data.frames.length - 1
            )}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Prev
          </button>
          <button
            onClick={() => setCurrentFrame(prev => 
              (prev + 1) % data.frames.length
            )}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Next
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          Frame {currentFrame + 1} of {data.frames.length}
        </div>
      </div>

      <div className="text-sm text-gray-600">
        <div>Duration: {(data.duration / 1000).toFixed(2)}s</div>
        <div>Frame Rate: {data.frameRate.toFixed(1)} fps</div>
        <div>Resolution: {data.metadata.width}x{data.metadata.height}</div>
      </div>
    </div>
  );
}
