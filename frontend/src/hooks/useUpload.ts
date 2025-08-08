import { useState, useCallback } from 'react';
import { UploadService, type UploadProgress, type UploadResult } from '../services/uploadService';
import type { RecordingData } from '../types/landmarks';

export function useUpload() {
  const [progress, setProgress] = useState<UploadProgress>({
    videoProgress: 0,
    landmarkProgress: 0,
    status: 'idle'
  });

  const upload = useCallback(async (
    signId: string,
    videoBlob: Blob,
    landmarkData: RecordingData
  ): Promise<UploadResult> => {
    try {
      return await UploadService.uploadRecording(videoBlob, landmarkData, setProgress);
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
  }, []);

  return {
    upload,
    progress,
    reset
  };
}