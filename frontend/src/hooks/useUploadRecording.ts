import { useState, useCallback } from 'react';
import { UploadService, type UploadProgress, type UploadResult } from '../services/uploadService';
import type { RecordingData } from '../types/landmarks';

export function useUploadRecording() {
  const [progress, setProgress] = useState<UploadProgress>({
    videoProgress: 0,
    landmarkProgress: 0,
    status: 'idle'
  });

  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);

  const uploadRecording = useCallback(async (
    videoBlob: Blob,
    landmarkData: RecordingData
  ): Promise<UploadResult> => {
    try {
      const result = await UploadService.uploadRecording(
        videoBlob,
        landmarkData,
        (progress) => setProgress(progress)
      );
      setLastUpload(result);
      return result;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setProgress({
      videoProgress: 0,
      landmarkProgress: 0,
      status: 'idle'
    });
    setLastUpload(null);
  }, []);

  return {
    uploadRecording,
    progress,
    lastUpload,
    reset
  };
}
