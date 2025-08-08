export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'student' | 'teacher';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      signs: {
        Row: {
          id: string;
          gloss: string;
          exemplar_landmarks: Json;
          difficulty: number | null;
          tags: string[] | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gloss: string;
          exemplar_landmarks: Json;
          difficulty?: number | null;
          tags?: string[] | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gloss?: string;
          exemplar_landmarks?: Json;
          difficulty?: number | null;
          tags?: string[] | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      attempts: {
        Row: {
          id: string;
          student_id: string;
          sign_id: string;
          score_shape: number | null;
          score_location: number | null;
          score_movement: number | null;
          total_score: number | null;
          heatmap: Json | null;
          video_url: string | null;
          feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          sign_id: string;
          score_shape?: number | null;
          score_location?: number | null;
          score_movement?: number | null;
          heatmap?: Json | null;
          video_url?: string | null;
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          sign_id?: string;
          score_shape?: number | null;
          score_location?: number | null;
          score_movement?: number | null;
          heatmap?: Json | null;
          video_url?: string | null;
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          attempt_id: string;
          teacher_id: string;
          comment: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          teacher_id: string;
          comment: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          teacher_id?: string;
          comment?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
    };
  };
}
