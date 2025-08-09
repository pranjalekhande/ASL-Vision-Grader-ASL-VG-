import { supabase } from '../config/supabase';
import type { RecordingData } from '../types/landmarks';

export interface UploadAttemptParams {
  signId: string;
  videoBlob: Blob;
  landmarkData: RecordingData;
}

export class SupabaseService {
  private static generateStoragePath(type: 'video' | 'landmarks', id: string) {
    return `attempts/${type}/${id}`;
  }

  static async uploadAttempt({ signId, videoBlob, landmarkData }: UploadAttemptParams) {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error('No user found');

      // Create attempt record
      const { data: attempt, error: attemptError } = await supabase
        .from('attempts')
        .insert({
          student_id: user.id,
          sign_id: signId,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (attemptError || !attempt) throw attemptError || new Error('Failed to create attempt');

      // Upload video
      const videoPath = this.generateStoragePath('video', attempt.id);
      const { error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoPath, videoBlob, {
          contentType: 'video/webm',
          cacheControl: '3600',
        });

      if (videoError) throw videoError;

      // Upload landmarks
      const landmarksPath = this.generateStoragePath('landmarks', attempt.id);
      const { error: landmarksError } = await supabase.storage
        .from('landmarks')
        .upload(landmarksPath, JSON.stringify(landmarkData), {
          contentType: 'application/json',
          cacheControl: '3600',
        });

      if (landmarksError) throw landmarksError;

      // Get video URL
      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(videoPath);

      // Update attempt with video URL
      const { error: updateError } = await supabase
        .from('attempts')
        .update({ video_url: videoUrl })
        .eq('id', attempt.id);

      if (updateError) throw updateError;

      return attempt;
    } catch (error) {
      console.error('Error uploading attempt:', error);
      throw error;
    }
  }

  static async getSignById(signId: string) {
    const { data, error } = await supabase
      .from('signs')
      .select('*')
      .eq('id', signId)
      .single();

    if (error) throw error;
    return data;
  }

  static async getAttemptsBySignId(signId: string) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('No user found');

    const { data, error } = await supabase
      .from('attempts')
      .select('*')
      .eq('sign_id', signId)
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async updateAttemptScores(
    attemptId: string,
    scores: {
      score_shape?: number;
      score_location?: number;
      score_movement?: number;
      heatmap?: any;
    }
  ) {
    const { error } = await supabase
      .from('attempts')
      .update(scores)
      .eq('id', attemptId);

    if (error) throw error;
  }
}


