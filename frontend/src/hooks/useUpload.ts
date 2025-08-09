import { useState, useCallback } from 'react';
import { UploadService, type UploadProgress, type UploadResult } from '../services/uploadService';
import type { RecordingData } from '../types/landmarks';

export function useUpload() {
  const [progress, setProgress] = useState<UploadProgress>({
    videoProgress: 0,
    landmarkProgress: 0,
    status: 'idle'
  });

  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null);

  const upload = useCallback(async (
    signId: string,
    videoBlob: Blob,
    landmarkData: RecordingData
  ): Promise<UploadResult> => {
    try {
      const result = await UploadService.uploadRecording(videoBlob, landmarkData, setProgress);
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
    upload,
    progress,
    lastUpload,
    reset
  };
}