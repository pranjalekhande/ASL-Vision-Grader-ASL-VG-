import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string | null;
  institution: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: { message: string } | null;
  mfaRequired: boolean;
}

export function useAuth2FA() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
    mfaRequired: false,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setState(prev => ({ ...prev, error: { message: error.message }, loading: false }));
        return;
      }

      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          profile: null,
          loading: false,
          error: null,
          mfaRequired: false,
        });
      } else if (event === 'MFA_CHALLENGE_VERIFIED') {
        // MFA challenge completed
        setState(prev => ({ ...prev, mfaRequired: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (user: User) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Profile load error:', error);
        setState(prev => ({ 
          ...prev, 
          user, 
          profile: null, 
          loading: false,
          error: { message: 'Failed to load user profile' }
        }));
        return;
      }

      setState(prev => ({ 
        ...prev, 
        user, 
        profile: profile as UserProfile, 
        loading: false,
        error: null 
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        user, 
        profile: null, 
        loading: false,
        error: { message: err.message || 'Unknown error' }
      }));
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    metadata: { role: UserRole; full_name: string; institution?: string }
  ) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });

      if (error) throw error;

      // If user was created successfully, create their profile manually
      if (data.user) {
        try {
          // Create profile record manually
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              role: metadata.role,
              full_name: metadata.full_name,
            });

          if (profileError) {
            console.warn('Profile creation failed, but user signup succeeded:', profileError);
          }
        } catch (profileErr) {
          console.warn('Profile creation error:', profileErr);
        }

        if (!data.session) {
          setState(prev => ({ 
            ...prev, 
            error: { message: 'Please check your email to confirm your account' }
          }));
        }
      }

      return { success: true };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to create account';
      setState(prev => ({ ...prev, error: { message: errorMsg } }));
      throw new Error(errorMsg);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if MFA is required
      if (data.user && !data.session) {
        setState(prev => ({ ...prev, mfaRequired: true }));
        return { success: true, mfaRequired: true };
      }

      return { success: true, mfaRequired: false };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to sign in';
      setState(prev => ({ ...prev, error: { message: errorMsg } }));
      throw new Error(errorMsg);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        error: { message: err.message || 'Failed to sign out' }
      }));
      throw err;
    }
  };

  const enrollMFA = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        error: { message: err.message || 'Failed to enroll MFA' }
      }));
      throw err;
    }
  };

  const verifyMFA = async (factorId: string, challengeId: string, code: string) => {
    try {
      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        error: { message: err.message || 'Invalid verification code' }
      }));
      throw err;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!state.user) throw new Error('Not authenticated');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', state.user.id)
        .select()
        .single();

      if (error) throw error;

      setState(prev => ({ 
        ...prev, 
        profile: data as UserProfile 
      }));

      return data;
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        error: { message: err.message || 'Failed to update profile' }
      }));
      throw err;
    }
  };

  // Helper functions
  const isTeacher = () => state.profile?.role === 'teacher' || state.profile?.role === 'admin';
  const isStudent = () => state.profile?.role === 'student';
  const isAdmin = () => state.profile?.role === 'admin';
  const isAuthenticated = () => !!state.user && !!state.profile;

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    enrollMFA,
    verifyMFA,
    updateProfile,
    isTeacher,
    isStudent,
    isAdmin,
    isAuthenticated,
  };
}
