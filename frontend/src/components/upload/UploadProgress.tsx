import React from 'react';
import type { UploadProgress as UploadProgressType } from '../../services/uploadService';

interface UploadProgressProps {
  progress: UploadProgressType;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ progress }) => {
  if (progress.status === 'idle') return null;

  const getStatusColor = () => {
    switch (progress.status) {
      case 'uploading':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Video Upload</span>
        <span className="text-sm font-medium text-gray-500">
          {progress.videoProgress}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${progress.videoProgress}%` }}
        />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Landmark Data</span>
        <span className="text-sm font-medium text-gray-500">
          {progress.landmarkProgress}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${progress.landmarkProgress}%` }}
        />
      </div>

      {progress.error && (
        <div className="text-red-500 text-sm mt-2">
          {progress.error}
        </div>
      )}
    </div>
  );
};