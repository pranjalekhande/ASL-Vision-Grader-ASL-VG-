import { useRef, useEffect, useState, useCallback } from 'react';
import { useVideoRecorder } from '../../hooks/useVideoRecorder';
import { useMediaPipe } from '../../hooks/useMediaPipe';
import type { VideoRecorderProps } from '../../types/video';
import type { HandLandmarkerResult } from '../../types/mediapipe';

export const VideoRecorder = ({
  maxDuration = 7,
  onRecordingComplete,
  width = 1280,
  height = 720,
}: VideoRecorderProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landmarks, setLandmarks] = useState<HandLandmarkerResult | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [showRecordedVideo, setShowRecordedVideo] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const animationFrameRef = useRef<number>();
  const lastProcessedTimeRef = useRef(0);
  const processingRef = useRef(false);
  const frameIntervalRef = useRef(1000 / 30); // Target 30fps
  const videoUrlRef = useRef<string | null>(null);

  const {
    isRecording,
    error: recordingError,
    startRecording,
    stopRecording,
    recordedBlob,
    stream,
  } = useVideoRecorder(maxDuration);

  const {
    isInitialized: isMediaPipeReady,
    error: mediaPipeError,
    detectLandmarks,
  } = useMediaPipe();

  // Clean up video URL when component unmounts or blob changes
  useEffect(() => {
    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, [recordedBlob]);

  // Set up video stream when available
  useEffect(() => {
    const setupVideo = async () => {
      if (!videoRef.current) return;
      
      try {
        if (!showRecordedVideo && stream) {
          videoRef.current.srcObject = stream;
          console.log('Live video stream set');
          setIsCameraReady(true);
        } else if (showRecordedVideo && recordedBlob) {
          videoRef.current.srcObject = null;
          if (videoUrlRef.current) {
            URL.revokeObjectURL(videoUrlRef.current);
          }
          videoUrlRef.current = URL.createObjectURL(recordedBlob);
          videoRef.current.src = videoUrlRef.current;
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error('Error setting video stream:', err);
        setIsCameraReady(false);
      }
    };

    setupVideo();
  }, [stream, showRecordedVideo, recordedBlob]);

  // Handle video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded:', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      });
      video.play().catch(err => console.error('Error playing video:', err));
    };

    const handleCanPlay = () => {
      console.log('Video can play');
      setIsVideoReady(true);
    };

    const handleError = (e: Event) => {
      const videoElement = e.target as HTMLVideoElement;
      console.error('Video error:', videoElement.error);
      setIsVideoReady(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, []);

  // Handle recording completion
  useEffect(() => {
    if (!isRecording && recordedBlob) {
      onRecordingComplete?.(recordedBlob);
    }
  }, [isRecording, recordedBlob, onRecordingComplete]);

  const processFrame = useCallback(async (now: number) => {
    if (!videoRef.current || !isMediaPipeReady || !isVideoReady || processingRef.current) return;

    const timeSinceLastProcess = now - lastProcessedTimeRef.current;
    if (timeSinceLastProcess < frameIntervalRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    try {
      processingRef.current = true;
      const result = await detectLandmarks(videoRef.current, now);
      if (result) {
        setLandmarks(result);
        lastProcessedTimeRef.current = now;
      }
    } finally {
      processingRef.current = false;
    }

    if (videoRef.current && !videoRef.current.paused) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [isMediaPipeReady, isVideoReady, detectLandmarks]);

  // MediaPipe detection loop
  useEffect(() => {
    if (isMediaPipeReady && isVideoReady && !processingRef.current && showLandmarks) {
      console.log('Starting landmark detection loop');
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      if (animationFrameRef.current) {
        console.log('Stopping landmark detection loop');
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      processingRef.current = false;
    };
  }, [isMediaPipeReady, isVideoReady, processFrame, showLandmarks]);

  const drawLandmarks = useCallback(() => {
    if (!canvasRef.current || !landmarks) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear previous drawing
    ctx.clearRect(0, 0, width, height);

    // Draw landmarks
    landmarks.landmarks.forEach((handLandmarks) => {
      handLandmarks.forEach((landmark, index) => {
        if (landmark.visibility && landmark.visibility < 0.5) return;

        ctx.beginPath();
        ctx.arc(landmark.x * width, landmark.y * height, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#00FF00';
        ctx.fill();

        // Draw connections between landmarks (simplified)
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
  }, [landmarks, width, height]);

  // Draw landmarks when available and enabled
  useEffect(() => {
    if (showLandmarks) {
      drawLandmarks();
    } else if (canvasRef.current) {
      // Clear canvas when landmarks are hidden
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
      }
    }
  }, [drawLandmarks, showLandmarks, width, height]);

  const isReadyToRecord = isMediaPipeReady && isVideoReady && isCameraReady;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* View toggle buttons */}
      {recordedBlob && (
        <div className="flex justify-center space-x-4 mb-4">
          <button
            onClick={() => setShowRecordedVideo(false)}
            className={`px-4 py-2 rounded-lg font-medium transition duration-300 ease-in-out ${
              !showRecordedVideo ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Live Camera
          </button>
          <button
            onClick={() => setShowRecordedVideo(true)}
            className={`px-4 py-2 rounded-lg font-medium transition duration-300 ease-in-out ${
              showRecordedVideo ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Recorded Video
          </button>
          <button
            onClick={() => setShowLandmarks(prev => !prev)}
            className={`px-4 py-2 rounded-lg font-medium transition duration-300 ease-in-out ${
              showLandmarks ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showLandmarks ? 'Hide Landmarks' : 'Show Landmarks'}
          </button>
        </div>
      )}

      {/* Video container */}
      <div className="relative w-full max-w-xl bg-gray-700 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-auto rounded-lg"
          width={width}
          height={height}
          autoPlay
          playsInline
          muted={!showRecordedVideo}
          controls={showRecordedVideo}
          onTimeUpdate={() => {
            if (showRecordedVideo && showLandmarks && !processingRef.current) {
              requestAnimationFrame(processFrame);
            }
          }}
          onPlay={() => {
            console.log('Video playback started');
            setIsVideoReady(true);
            if (showRecordedVideo && showLandmarks) {
              requestAnimationFrame(processFrame);
            }
          }}
          onPause={() => {
            console.log('Video playback paused');
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = undefined;
            }
          }}
          onSeeked={() => {
            console.log('Video seeked');
            if (showRecordedVideo && showLandmarks) {
              requestAnimationFrame(processFrame);
            }
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          width={width}
          height={height}
        />
        {isRecording && (
          <div className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
            REC
          </div>
        )}
      </div>

      {/* Recording controls - only show in live view */}
      {!showRecordedVideo && (
        <div className="flex space-x-4 mt-4">
          <button
            onClick={startRecording}
            disabled={isRecording || !isReadyToRecord}
            className={`px-6 py-3 rounded-lg text-lg font-medium transition duration-300 ease-in-out ${
              isRecording || !isReadyToRecord ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            Start Recording
          </button>
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className={`px-6 py-3 rounded-lg text-lg font-medium transition duration-300 ease-in-out ${
              !isRecording ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            Stop Recording
          </button>
        </div>
      )}

      {/* Status messages */}
      {!isCameraReady && (
        <div className="text-blue-500 text-sm">
          Initializing camera...
        </div>
      )}

      {!isMediaPipeReady && (
        <div className="text-blue-500 text-sm">
          Initializing MediaPipe...
        </div>
      )}

      {!isVideoReady && stream && (
        <div className="text-blue-500 text-sm">
          Preparing video...
        </div>
      )}

      {/* Error messages */}
      {(recordingError || mediaPipeError) && (
        <p className="text-red-500 mt-4 text-center">{recordingError || mediaPipeError}</p>
      )}
    </div>
  );
};