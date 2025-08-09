import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

type UserRole = 'student' | 'teacher';

interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setError({ message: error.message });
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        setUser(session.user);
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        // Use setTimeout to avoid blocking the auth state change
        setTimeout(() => {
          loadUserProfile(session.user.id);
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile load error:', error);
        // If no profile exists, user might be using metadata role
        const metadataRole = user?.user_metadata?.role || 'student';
        setProfile({
          id: userId,
          role: metadataRole,
          full_name: user?.user_metadata?.full_name || null
        });
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile loading failed:', err);
      // Fallback to metadata
      const metadataRole = user?.user_metadata?.role || 'student';
      setProfile({
        id: userId,
        role: metadataRole,
        full_name: user?.user_metadata?.full_name || null
      });
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setError(null); // Clear previous errors
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      setError({ message: err.message || 'Unknown error occurred' });
      throw err;
    }
  };

  const signUp = async (email: string, password: string, metadata?: { role: string }) => {
    try {
      setError(null); // Clear previous errors
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata || { role: 'student' }
        }
      });
      
      if (error) throw error;
      
      // Check if email confirmation is required
      if (data.user && !data.session) {
        setError({ message: 'Please check your email to confirm your account' });
      }
    } catch (err: any) {
      setError({ message: err.message || 'Unknown error occurred' });
      throw err;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      setError({ message: err.message || 'Unknown error occurred' });
      throw err;
    }
  };

  const getUserRole = (): UserRole | null => {
    return profile?.role || null;
  };

  const isTeacher = (): boolean => {
    return profile?.role === 'teacher';
  };

  const isStudent = (): boolean => {
    return profile?.role === 'student';
  };

  const isAuthenticated = (): boolean => {
    return !!(user && profile);
  };

  return {
    user,
    profile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    getUserRole,
    isTeacher,
    isStudent,
    isAuthenticated,
  };
}