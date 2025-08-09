import { supabase } from '../config/supabase';
import type {
  ReferenceSign,
  SignMetadata,
  CreateSignInput,
  UpdateSignInput,
  SignSearchParams,
  SignProgress
} from '../types/signs';

/**
 * Service for managing reference signs
 */
export class SignService {
  private static readonly VIDEOS_BUCKET = 'videos';
  private static readonly VIDEOS_PATH = 'reference';
  private static readonly THUMBNAILS_PATH = 'thumbnails';

  /**
   * Create a new reference sign
   */
  async createSign(input: CreateSignInput): Promise<ReferenceSign> {
    const { videoBlob, landmarks, ...metadata } = input;
    
    // Upload video
    const videoPath = `${SignService.VIDEOS_PATH}/${Date.now()}.webm`;
    const { data: videoData, error: videoError } = await supabase.storage
      .from(SignService.VIDEOS_BUCKET)
      .upload(videoPath, videoBlob);
    
    if (videoError) throw videoError;

    // Get video URL
    const { data: { publicUrl: videoUrl } } = supabase.storage
      .from(SignService.VIDEOS_BUCKET)
      .getPublicUrl(videoPath);

    // Insert sign data
    const insertData = {
      name: metadata.name,
      gloss: metadata.name, // Database still expects gloss field
      description: metadata.description,
      category: metadata.category,
      tags: metadata.tags,
      difficulty: metadata.difficulty === 'beginner' ? 1 : metadata.difficulty === 'intermediate' ? 3 : 5,
      status: 'published',
      video_url: videoUrl,
      landmarks: { frames: landmarks },
      created_by: (await supabase.auth.getUser()).data.user?.id
    };
    
    console.log('SignService: About to insert:', insertData);
    
    const { data: sign, error: signError } = await supabase
      .from('signs')
      .insert(insertData)
      .select()
      .single();
      
    console.log('SignService: Insert result:', { sign, signError });
    
    if (signError) {
      console.error('SignService: Database error details:', signError);
      throw signError;
    }

    return this.mapSignFromDB(sign);
  }

  /**
   * Update an existing reference sign
   */
  async updateSign(input: UpdateSignInput): Promise<ReferenceSign> {
    const { id, videoBlob, ...updates } = input;
    let videoUrl = undefined;

    // Upload new video if provided
    if (videoBlob) {
      const videoPath = `${SignService.VIDEOS_PATH}/${Date.now()}.webm`;
      const { error: videoError } = await supabase.storage
        .from(SignService.VIDEOS_BUCKET)
        .upload(videoPath, videoBlob);
      
      if (videoError) throw videoError;

      const { data: { publicUrl } } = supabase.storage
        .from(SignService.VIDEOS_BUCKET)
        .getPublicUrl(videoPath);
      
      videoUrl = publicUrl;
    }

    // Update sign data
    const { data: sign, error: signError } = await supabase
      .from('signs')
      .update({
        ...updates,
        ...(videoUrl && { video_url: videoUrl }),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (signError) throw signError;

    return this.mapSignFromDB(sign);
  }

  /**
   * Get a reference sign by ID
   */
  async getSign(id: string): Promise<ReferenceSign> {
    const { data: sign, error } = await supabase
      .from('signs')
      .select()
      .eq('id', id)
      .single();

    if (error) throw error;
    return this.mapSignFromDB(sign);
  }

  /**
   * Search for reference signs
   */
  async searchSigns(params: SignSearchParams = {}): Promise<ReferenceSign[]> {
    const {
      query,
      difficulty,
      category,
      tags,
      status,
      createdBy,
      page = 1,
      limit = 20
    } = params;

    let query_ = supabase
      .from('signs')
      .select()
      .order('created_at', { ascending: false });

    if (query) {
      query_ = query_.ilike('name', `%${query}%`);
    }

    if (difficulty) {
      query_ = query_.eq('difficulty', difficulty);
    }

    if (category) {
      query_ = query_.eq('category', category);
    }

    if (tags && tags.length > 0) {
      query_ = query_.contains('tags', tags);
    }

    if (status) {
      query_ = query_.eq('status', status);
    }

    if (createdBy) {
      query_ = query_.eq('created_by', createdBy);
    }

    const { data: signs, error } = await query_
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;
    return signs.map(this.mapSignFromDB);
  }

  /**
   * Get a user's progress for a specific sign
   */
  async getSignProgress(signId: string): Promise<SignProgress | null> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return null;

    const { data: attempts, error } = await supabase
      .from('attempts')
      .select('*, feedback(*)')
      .eq('sign_id', signId)
      .eq('student_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!attempts.length) return null;

    const history = attempts.map(attempt => ({
      signId,
      overallScore: attempt.total_score,
      handshapeScore: attempt.score_shape,
      locationScore: attempt.score_location,
      movementScore: attempt.score_movement,
      feedback: attempt.feedback?.[0]?.comment || '',
      timestamp: attempt.created_at
    }));

    const bestScore = Math.max(...attempts.map(a => a.total_score));

    return {
      userId,
      signId,
      attempts: attempts.length,
      bestScore,
      lastAttempt: attempts[0].created_at,
      mastered: bestScore >= 90,
      history
    };
  }

  /**
   * Map a database sign record to our ReferenceSign type
   */
  private mapSignFromDB(sign: any): ReferenceSign {
    return {
      id: sign.id,
      name: sign.name,
      description: sign.description || '',
      difficulty: sign.difficulty,
      category: sign.category,
      status: sign.status,
      tags: sign.tags,
      createdAt: sign.created_at,
      updatedAt: sign.updated_at,
      createdBy: sign.created_by,
      videoUrl: sign.video_url,
      thumbnailUrl: sign.thumbnail_url,
      landmarks: sign.landmarks
    };
  }
}


