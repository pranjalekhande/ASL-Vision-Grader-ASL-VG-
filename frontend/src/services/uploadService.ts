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
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 2000; // 2 seconds

  private static async uploadWithRetry(
    bucket: 'videos' | 'landmarks',
    fileName: string,
    data: Blob | string,
    attempt: number = 1
  ): Promise<string> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(fileName, data, {
          cacheControl: '3600',
          upsert: attempt > 1 // Allow overwrite on retry
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        console.log(`Upload attempt ${attempt} failed, retrying in ${this.RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.uploadWithRetry(bucket, fileName, data, attempt + 1);
      }
      throw error;
    }
  }

  static async uploadRecording(
    videoBlob: Blob,
    landmarkData: RecordingData,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      const timestamp = Date.now();
      let currentProgress: UploadProgress = {
        videoProgress: 0,
        landmarkProgress: 0,
        status: 'uploading'
      };

      onProgress?.(currentProgress);

      // Upload video with retry
      const videoFileName = `recording-${timestamp}.webm`;
      console.log('Uploading video:', videoFileName);
      
      let videoUrl: string;
      try {
        videoUrl = await this.uploadWithRetry('videos', videoFileName, videoBlob);
        currentProgress = {
          ...currentProgress,
          videoProgress: 100
        };
        onProgress?.(currentProgress);
      } catch (error) {
        throw new Error(`Video upload failed after ${this.MAX_RETRIES} attempts: ${error.message}`);
      }

      // Upload landmarks with retry
      const landmarkFileName = `landmarks-${timestamp}.json`;

      
      let landmarkUrl: string;
      try {
        landmarkUrl = await this.uploadWithRetry(
          'landmarks',
          landmarkFileName,
          JSON.stringify(landmarkData, null, 2) // Pretty print for readability
        );
        currentProgress = {
          videoProgress: 100,
          landmarkProgress: 100,
          status: 'completed'
        };
        onProgress?.(currentProgress);
      } catch (error) {
        // If landmarks fail but video succeeded, we should handle this case
        throw new Error(`Landmark upload failed after ${this.MAX_RETRIES} attempts: ${error.message}`);
      }

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

  static async getLandmarkData(url: string): Promise<RecordingData> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch landmark data: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching landmark data:', error);
      throw error;
    }
  }
}