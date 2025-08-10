import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VideoReviewPlayer } from './VideoReviewPlayer';
import type { HandLandmarkFrame } from '../../types/landmarks';

interface SynchronizedVideoComparisonProps {
  studentVideoUrl: string;
  exemplarVideoUrl: string;
  studentLandmarks: HandLandmarkFrame[];
  exemplarLandmarks: HandLandmarkFrame[];
  signName: string;
  onFrameSync?: (studentFrame: number, exemplarFrame: number, timestamp: number) => void;
}

export const SynchronizedVideoComparison: React.FC<SynchronizedVideoComparisonProps> = ({
  studentVideoUrl,
  exemplarVideoUrl,
  studentLandmarks,
  exemplarLandmarks,
  signName,
  onFrameSync
}) => {
  const [isSynchronized, setIsSynchronized] = useState(true);
  const [currentStudentFrame, setCurrentStudentFrame] = useState(0);
  const [currentExemplarFrame, setCurrentExemplarFrame] = useState(0);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  
  const lastSyncRef = useRef<{ student: number; exemplar: number }>({ student: 0, exemplar: 0 });

  // Calculate frame mapping for synchronization
  const getCorrespondingFrame = useCallback((sourceFrame: number, sourceTotal: number, targetTotal: number) => {
    if (sourceTotal === 0 || targetTotal === 0) return 0;
    const ratio = sourceFrame / (sourceTotal - 1);
    return Math.round(ratio * (targetTotal - 1));
  }, []);

  // Handle frame changes from student video
  const handleStudentFrameChange = useCallback((frameIndex: number, timestamp: number) => {
    setCurrentStudentFrame(frameIndex);
    
    if (isSynchronized && exemplarLandmarks.length > 0) {
      const correspondingExemplarFrame = getCorrespondingFrame(
        frameIndex,
        studentLandmarks.length,
        exemplarLandmarks.length
      );
      setCurrentExemplarFrame(correspondingExemplarFrame);
      lastSyncRef.current = { student: frameIndex, exemplar: correspondingExemplarFrame };
      onFrameSync?.(frameIndex, correspondingExemplarFrame, timestamp);
    } else {
      lastSyncRef.current.student = frameIndex;
      onFrameSync?.(frameIndex, currentExemplarFrame, timestamp);
    }
  }, [isSynchronized, exemplarLandmarks.length, studentLandmarks.length, getCorrespondingFrame, currentExemplarFrame, onFrameSync]);

  // Handle frame changes from exemplar video
  const handleExemplarFrameChange = useCallback((frameIndex: number, timestamp: number) => {
    setCurrentExemplarFrame(frameIndex);
    
    if (isSynchronized && studentLandmarks.length > 0) {
      const correspondingStudentFrame = getCorrespondingFrame(
        frameIndex,
        exemplarLandmarks.length,
        studentLandmarks.length
      );
      setCurrentStudentFrame(correspondingStudentFrame);
      lastSyncRef.current = { student: correspondingStudentFrame, exemplar: frameIndex };
      onFrameSync?.(correspondingStudentFrame, frameIndex, timestamp);
    } else {
      lastSyncRef.current.exemplar = frameIndex;
      onFrameSync?.(currentStudentFrame, frameIndex, timestamp);
    }
  }, [isSynchronized, studentLandmarks.length, exemplarLandmarks.length, getCorrespondingFrame, currentStudentFrame, onFrameSync]);

  // Toggle synchronization
  const toggleSynchronization = useCallback(() => {
    setIsSynchronized(prev => {
      if (!prev) {
        // Re-enabling sync - sync current frames
        const { student, exemplar } = lastSyncRef.current;
        if (studentLandmarks.length > 0 && exemplarLandmarks.length > 0) {
          const correspondingExemplarFrame = getCorrespondingFrame(
            student,
            studentLandmarks.length,
            exemplarLandmarks.length
          );
          setCurrentExemplarFrame(correspondingExemplarFrame);
          onFrameSync?.(student, correspondingExemplarFrame, 0);
        }
      }
      return !prev;
    });
  }, [studentLandmarks.length, exemplarLandmarks.length, getCorrespondingFrame, onFrameSync]);

  // Calculate frame differences for visualization
  const getFrameDifference = useCallback(() => {
    if (studentLandmarks.length === 0 || exemplarLandmarks.length === 0) {
      return { difference: 0, alignment: 'perfect' as const };
    }

    const studentRatio = currentStudentFrame / (studentLandmarks.length - 1);
    const exemplarRatio = currentExemplarFrame / (exemplarLandmarks.length - 1);
    const difference = Math.abs(studentRatio - exemplarRatio);

    let alignment: 'perfect' | 'good' | 'fair' | 'poor';
    if (difference < 0.05) alignment = 'perfect';
    else if (difference < 0.15) alignment = 'good';
    else if (difference < 0.3) alignment = 'fair';
    else alignment = 'poor';

    return { difference: difference * 100, alignment };
  }, [currentStudentFrame, currentExemplarFrame, studentLandmarks.length, exemplarLandmarks.length]);

  const frameDiff = getFrameDifference();

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">{signName} - Video Comparison</h2>
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Synchronization controls */}
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSynchronization}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isSynchronized
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
              }`}
            >
              {isSynchronized ? 'Synchronized' : 'Independent'}
            </button>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Landmarks:</label>
              <button
                onClick={() => setShowLandmarks(!showLandmarks)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  showLandmarks
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showLandmarks ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">View:</label>
              <select
                value={comparisonMode}
                onChange={(e) => setComparisonMode(e.target.value as 'side-by-side' | 'overlay')}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="side-by-side">Side by Side</option>
                <option value="overlay">Overlay</option>
              </select>
            </div>
          </div>

          {/* Frame alignment indicator */}
          {isSynchronized && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Frame Alignment:</span>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                frameDiff.alignment === 'perfect' ? 'bg-green-100 text-green-800' :
                frameDiff.alignment === 'good' ? 'bg-blue-100 text-blue-800' :
                frameDiff.alignment === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {frameDiff.alignment} ({frameDiff.difference.toFixed(1)}%)
              </div>
            </div>
          )}

          {/* Speed control */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Video comparison */}
      {comparisonMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Student video */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Student Attempt</h3>
              <div className="text-sm text-gray-500">
                Frame: {currentStudentFrame + 1} / {studentLandmarks.length}
              </div>
            </div>
            <VideoReviewPlayer
              videoUrl={studentVideoUrl}
              landmarks={studentLandmarks}
              width={640}
              height={480}
              onFrameChange={handleStudentFrameChange}
              showLandmarks={showLandmarks}
              playbackSpeed={playbackSpeed}
            />
          </div>

          {/* Exemplar video */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Reference Exemplar</h3>
              <div className="text-sm text-gray-500">
                Frame: {currentExemplarFrame + 1} / {exemplarLandmarks.length}
              </div>
            </div>
            <VideoReviewPlayer
              videoUrl={exemplarVideoUrl}
              landmarks={exemplarLandmarks}
              width={640}
              height={480}
              onFrameChange={handleExemplarFrameChange}
              showLandmarks={showLandmarks}
              playbackSpeed={playbackSpeed}
            />
          </div>
        </div>
      ) : (
        // Overlay mode - this would require more complex implementation
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">Overlay mode coming soon</p>
            <p className="text-sm">This will show both videos superimposed for direct comparison</p>
          </div>
        </div>
      )}

      {/* Frame synchronization status */}
      {isSynchronized && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Synchronization Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Student Frame:</span>
              <span className="ml-2 font-medium">{currentStudentFrame + 1}</span>
            </div>
            <div>
              <span className="text-gray-600">Exemplar Frame:</span>
              <span className="ml-2 font-medium">{currentExemplarFrame + 1}</span>
            </div>
            <div>
              <span className="text-gray-600">Student Progress:</span>
              <span className="ml-2 font-medium">
                {studentLandmarks.length > 0 ? ((currentStudentFrame / (studentLandmarks.length - 1)) * 100).toFixed(1) : 0}%
              </span>
            </div>
            <div>
              <span className="text-gray-600">Exemplar Progress:</span>
              <span className="ml-2 font-medium">
                {exemplarLandmarks.length > 0 ? ((currentExemplarFrame / (exemplarLandmarks.length - 1)) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
