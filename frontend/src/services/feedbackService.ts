import { supabase } from '../config/supabase';

export interface FeedbackItem {
  id: string;
  attempt_id: string;
  teacher_id: string;
  content: string;
  timestamp_seconds: number;
  category: 'shape' | 'location' | 'movement' | 'general';
  severity: 'low' | 'medium' | 'high';
  area_coordinates?: { x: number; y: number; width: number; height: number };
  created_at: string;
  updated_at: string;
}

export interface FeedbackTemplate {
  id: string;
  teacher_id: string;
  name: string;
  category: 'shape' | 'location' | 'movement' | 'general';
  content: string;
  severity: 'low' | 'medium' | 'high';
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackParams {
  attempt_id: string;
  content: string;
  timestamp_seconds: number;
  category: 'shape' | 'location' | 'movement' | 'general';
  severity: 'low' | 'medium' | 'high';
  area_coordinates?: { x: number; y: number; width: number; height: number };
}

export interface UpdateFeedbackParams {
  content?: string;
  timestamp_seconds?: number;
  category?: 'shape' | 'location' | 'movement' | 'general';
  severity?: 'low' | 'medium' | 'high';
  area_coordinates?: { x: number; y: number; width: number; height: number };
}

export class FeedbackService {
  /**
   * Load all feedback for a specific attempt
   */
  static async getFeedbackForAttempt(attemptId: string): Promise<FeedbackItem[]> {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('timestamp_seconds', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading feedback:', error);
      throw error;
    }
  }

  /**
   * Add new feedback to an attempt
   */
  static async addFeedback(params: CreateFeedbackParams): Promise<FeedbackItem> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('feedback')
        .insert({
          ...params,
          teacher_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create notification for student
      await this.createFeedbackNotification(data.id, params.attempt_id);

      return data;
    } catch (error) {
      console.error('Error adding feedback:', error);
      throw error;
    }
  }

  /**
   * Update existing feedback
   */
  static async updateFeedback(feedbackId: string, params: UpdateFeedbackParams): Promise<FeedbackItem> {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .update({
          ...params,
          updated_at: new Date().toISOString(),
        })
        .eq('id', feedbackId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }
  }

  /**
   * Delete feedback
   */
  static async deleteFeedback(feedbackId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', feedbackId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }
  }

  /**
   * Get feedback count for an attempt
   */
  static async getFeedbackCount(attemptId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('feedback')
        .select('*', { count: 'exact', head: true })
        .eq('attempt_id', attemptId);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting feedback count:', error);
      return 0;
    }
  }

  /**
   * Get feedback templates for current teacher
   */
  static async getFeedbackTemplates(): Promise<FeedbackTemplate[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('feedback_templates')
        .select('*')
        .eq('teacher_id', user.id)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading feedback templates:', error);
      return [];
    }
  }

  /**
   * Create a new feedback template
   */
  static async createFeedbackTemplate(params: {
    name: string;
    category: 'shape' | 'location' | 'movement' | 'general';
    content: string;
    severity: 'low' | 'medium' | 'high';
  }): Promise<FeedbackTemplate> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('feedback_templates')
        .insert({
          ...params,
          teacher_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating feedback template:', error);
      throw error;
    }
  }

  /**
   * Update feedback template usage count
   */
  static async incrementTemplateUsage(templateId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_template_usage', {
        template_id: templateId
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error incrementing template usage:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Create notification for student about new feedback
   */
  private static async createFeedbackNotification(feedbackId: string, attemptId: string): Promise<void> {
    try {
      // Get student ID from attempt
      const { data: attempt, error: attemptError } = await supabase
        .from('attempts')
        .select('student_id')
        .eq('id', attemptId)
        .single();

      if (attemptError || !attempt) return;

      // Create notification
      const { error } = await supabase
        .from('feedback_notifications')
        .insert({
          feedback_id: feedbackId,
          student_id: attempt.student_id,
        });

      if (error && error.code !== '23505') { // Ignore unique constraint violations
        console.error('Error creating feedback notification:', error);
      }
    } catch (error) {
      console.error('Error creating feedback notification:', error);
      // Don't throw - notifications are not critical
    }
  }

  /**
   * Get unread feedback notifications for current user
   */
  static async getUnreadFeedbackNotifications(): Promise<any[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return [];

      const { data, error } = await supabase
        .from('feedback_notifications')
        .select(`
          *,
          feedback:feedback_id (
            content,
            timestamp_seconds,
            category,
            attempts:attempt_id (
              signs:sign_id (name)
            )
          )
        `)
        .eq('student_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading feedback notifications:', error);
      return [];
    }
  }

  /**
   * Mark feedback notification as read
   */
  static async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('feedback_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
}
