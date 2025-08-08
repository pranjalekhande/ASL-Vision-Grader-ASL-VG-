import { supabase } from '../config/supabase';
import type { RecordingData } from '../types/landmarks';

export interface UploadProgress {
  videoProgress: number;
  landmarkProgress: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface UploadResult {
  videoUrl: string;
  landmarkUrl: string;
  timestamp: number;
}

export class UploadService {
  static async uploadRecording(
    videoBlob: Blob,
    landmarkData: RecordingData,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      const timestamp = Date.now();
      onProgress?.({
        videoProgress: 0,
        landmarkProgress: 0,
        status: 'uploading'
      });

      // Upload video
      const videoFileName = `recording-${timestamp}.webm`;
      console.log('Uploading video:', videoFileName);
      
      const { error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoFileName, videoBlob);

      if (videoError) throw videoError;

      onProgress?.({
        videoProgress: 100,
        landmarkProgress: 0,
        status: 'uploading'
      });

      // Upload landmarks
      const landmarkFileName = `landmarks-${timestamp}.json`;
      console.log('Uploading landmarks:', landmarkFileName);
      
      const { error: landmarkError } = await supabase.storage
        .from('landmarks')
        .upload(landmarkFileName, JSON.stringify(landmarkData));

      if (landmarkError) throw landmarkError;

      onProgress?.({
        videoProgress: 100,
        landmarkProgress: 100,
        status: 'completed'
      });

      // Get public URLs
      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(videoFileName);

      const { data: { publicUrl: landmarkUrl } } = supabase.storage
        .from('landmarks')
        .getPublicUrl(landmarkFileName);

      return {
        videoUrl,
        landmarkUrl,
        timestamp
      };
    } catch (error) {
      console.error('Upload error:', error);
      onProgress?.({
        videoProgress: 0,
        landmarkProgress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed'
      });
      throw error;
    }
  }
}