import { useState, useCallback, useEffect } from 'react';
import { SignService } from '../services/signService';
import type {
  ReferenceSign,
  CreateSignInput,
  UpdateSignInput,
  SignSearchParams,
  SignProgress
} from '../types/signs';

interface UseReferenceSignState {
  signs: ReferenceSign[];
  currentSign: ReferenceSign | null;
  progress: SignProgress | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseReferenceSignActions {
  searchSigns: (params?: SignSearchParams) => Promise<void>;
  getSign: (id: string) => Promise<void>;
  createSign: (input: CreateSignInput) => Promise<void>;
  updateSign: (input: UpdateSignInput) => Promise<void>;
  getProgress: (signId: string) => Promise<void>;
  reset: () => void;
}

export function useReferenceSign(): UseReferenceSignState & UseReferenceSignActions {
  const [state, setState] = useState<UseReferenceSignState>({
    signs: [],
    currentSign: null,
    progress: null,
    isLoading: false,
    error: null
  });

  const signService = new SignService();

  const searchSigns = useCallback(async (params?: SignSearchParams) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const signs = await signService.searchSigns(params);
      setState(prev => ({ ...prev, signs, isLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));
    }
  }, []);

  const getSign = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const sign = await signService.getSign(id);
      setState(prev => ({
        ...prev,
        currentSign: sign,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));
    }
  }, []);

  const createSign = useCallback(async (input: CreateSignInput) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const sign = await signService.createSign(input);
      setState(prev => ({
        ...prev,
        signs: [sign, ...prev.signs],
        currentSign: sign,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));
    }
  }, []);

  const updateSign = useCallback(async (input: UpdateSignInput) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const sign = await signService.updateSign(input);
      setState(prev => ({
        ...prev,
        signs: prev.signs.map(s => s.id === sign.id ? sign : s),
        currentSign: sign,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));
    }
  }, []);

  const getProgress = useCallback(async (signId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const progress = await signService.getSignProgress(signId);
      setState(prev => ({
        ...prev,
        progress,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      signs: [],
      currentSign: null,
      progress: null,
      isLoading: false,
      error: null
    });
  }, []);

  // Load initial signs on mount
  useEffect(() => {
    searchSigns();
  }, [searchSigns]);

  return {
    ...state,
    searchSigns,
    getSign,
    createSign,
    updateSign,
    getProgress,
    reset
  };
}


