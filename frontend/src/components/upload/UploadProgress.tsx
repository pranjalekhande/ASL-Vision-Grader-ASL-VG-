import type { UploadProgress as UploadProgressType } from '../../services/uploadService';

interface Props {
  progress: UploadProgressType;
}

export function UploadProgress({ progress }: Props) {
  if (progress.status === 'idle') return null;

  return (
    <div className="mt-4 space-y-4">
      {/* Video Progress */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">Video Upload</span>
          <span className="text-sm font-medium text-gray-700">{progress.videoProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.videoProgress}%` }}
          />
        </div>
      </div>

      {/* Landmark Progress */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">Landmark Data</span>
          <span className="text-sm font-medium text-gray-700">{progress.landmarkProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.landmarkProgress}%` }}
          />
        </div>
      </div>

      {/* Status Message */}
      {progress.status === 'error' && progress.error && (
        <div className="text-red-600 text-sm mt-2">
          Error: {progress.error}
        </div>
      )}

      {progress.status === 'completed' && (
        <div className="text-green-600 text-sm mt-2 flex items-center">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Upload completed successfully
        </div>
      )}
    </div>
  );
}