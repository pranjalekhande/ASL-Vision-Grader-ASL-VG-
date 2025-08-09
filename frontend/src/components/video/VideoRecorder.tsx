import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useVideoRecorder } from '../../hooks/useVideoRecorder';
import { useMediaPipe } from '../../hooks/useMediaPipe';
import { useUpload } from '../../hooks/useUpload';
import type { VideoRecorderProps } from '../../types/video';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { LandmarkDataCollector } from '../../types/landmarks';
import { UploadProgress } from '../upload/UploadProgress';
import { LandmarkViewer } from '../landmarks/LandmarkViewer';


export const VideoRecorder: React.FC<VideoRecorderProps> = ({
  maxDuration = 7,
  onRecordingComplete,
  width = 1280,
  height = 720
}) => {
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
  // Run heavy landmark detection at a throttled rate (~10 fps) to avoid long rAF handlers
  const frameIntervalRef = useRef(100); // ms between detections
  const videoUrlRef = useRef<string | null>(null);
  const landmarkCollectorRef = useRef<LandmarkDataCollector>(new LandmarkDataCollector(width, height));
  const [recordedLandmarks, setRecordedLandmarks] = useState<RecordingData | null>(null);

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

  const { upload, progress, lastUpload, reset: resetUpload } = useUpload();

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
      console.log('Video can play', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      });
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setIsVideoReady(true);
      }
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

  // Handle recording start/stop
  useEffect(() => {
    console.log('VideoRecorder useEffect:', { isRecording, hasRecordedBlob: !!recordedBlob, hasRecordedLandmarks: !!recordedLandmarks });
    
    if (isRecording) {
      // Reset landmark collector when starting new recording
      landmarkCollectorRef.current.reset();
      setRecordedLandmarks(null);
      resetUpload();
    } else if (recordedBlob && !recordedLandmarks) {
      // Get landmark data when recording stops (only once)
      const landmarkData = landmarkCollectorRef.current.getData();
      setRecordedLandmarks(landmarkData);
      console.log('Recording completed with landmarks:', landmarkData);

      // Always call the completion callback immediately for form-based workflows
      // For ReferenceRecorder, we'll handle the upload separately
      console.log('About to call onRecordingComplete with:', { recordedBlob, frames: landmarkData.frames.length });
      onRecordingComplete?.(recordedBlob, landmarkData.frames);
      console.log('onRecordingComplete called successfully');

      // Upload the recording and landmarks (optional for reference recording)
      const handleUpload = async () => {
        try {
          // For now, we'll use a placeholder sign ID
          // Later, we'll get this from the current exercise/lesson
          const signId = 'placeholder-sign-id';
          const result = await upload(signId, recordedBlob, landmarkData);
          console.log('Upload completed:', result);
        } catch (error) {
          console.error('Upload failed:', error);
          // Don't block the UI - upload failure is handled separately
        }
      };

      handleUpload();
    }
  }, [isRecording, recordedBlob, recordedLandmarks, onRecordingComplete, upload, resetUpload]);

  const processFrame = useCallback((now: number) => {
    const video = videoRef.current;
    if (!video || !isMediaPipeReady || !isVideoReady || processingRef.current) return;

    // Double-check video dimensions before processing
    if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const timeSinceLastProcess = now - lastProcessedTimeRef.current;
    if (timeSinceLastProcess < frameIntervalRef.current) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Kick off detection asynchronously so this rAF handler returns quickly
    processingRef.current = true;
    Promise.resolve(detectLandmarks(video, now))
      .then((result) => {
        if (result) {
          setLandmarks(result);
          lastProcessedTimeRef.current = now;

          // Store landmarks if recording
          if (isRecording) {
            landmarkCollectorRef.current.processFrame(result, now);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        processingRef.current = false;
      });

    if (video && !video.paused) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [isMediaPipeReady, isVideoReady, detectLandmarks, isRecording]);

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

        // Draw connections between landmarks
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
          // Prefer rVFC when available to sync with decoded frames
          onTimeUpdate={() => {
            if (showRecordedVideo && showLandmarks && !processingRef.current) {
              const anyVideo = videoRef.current as any;
              if (anyVideo?.requestVideoFrameCallback) {
                anyVideo.requestVideoFrameCallback((now: number) => processFrame(now));
              } else {
                requestAnimationFrame(processFrame);
              }
            }
          }}
          onPlay={() => {
            console.log('Video playback started');
            setIsVideoReady(true);
            if (showRecordedVideo && showLandmarks) {
              const anyVideo = videoRef.current as any;
              if (anyVideo?.requestVideoFrameCallback) {
                anyVideo.requestVideoFrameCallback((now: number) => processFrame(now));
              } else {
                requestAnimationFrame(processFrame);
              }
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
              const anyVideo = videoRef.current as any;
              if (anyVideo?.requestVideoFrameCallback) {
                anyVideo.requestVideoFrameCallback((now: number) => processFrame(now));
              } else {
                requestAnimationFrame(processFrame);
              }
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
            className={`px-6 py-3 rounded-lg text-lg font-medium text-white transition duration-300 ease-in-out ${
              isRecording || !isReadyToRecord ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            Start Recording
          </button>
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className={`px-6 py-3 rounded-lg text-lg font-medium text-white transition duration-300 ease-in-out ${
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

      {/* Upload progress and landmark viewer */}
      <div className="space-y-4">
        <UploadProgress progress={progress} />
        {progress.status === 'completed' && lastUpload && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-2">Landmark Visualization</h3>
            <LandmarkViewer
              landmarkUrl={lastUpload.landmarkUrl}
              width={400}
              height={300}
            />
          </div>
        )}
      </div>
    </div>
  );
};