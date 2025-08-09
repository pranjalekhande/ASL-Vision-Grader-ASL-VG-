import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';
import type { ReferenceSign } from '../../types/signs';

interface SignListProps {
  onSignSelect?: (signId: string, signName: string) => void;
  showEditControls?: boolean; // For teacher mode
}

export function SignList({ onSignSelect, showEditControls = false }: SignListProps) {
  const [signs, setSigns] = useState<ReferenceSign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const { isTeacher } = useAuth();

  useEffect(() => {
    loadSigns();
  }, []);

  const loadSigns = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query based on filters
      let query = supabase
        .from('signs')
        .select(`
          id,
          name,
          description,
          difficulty,
          video_url,
          created_at,
          created_by
        `)
        .order('created_at', { ascending: false });

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery.trim()}%`);
      }

      // Apply difficulty filter
      if (difficultyFilter) {
        query = query.eq('difficulty', parseInt(difficultyFilter));
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Map the data to our ReferenceSign type
      const mappedSigns: ReferenceSign[] = (data || []).map(sign => ({
        id: sign.id,
        name: sign.name || 'Untitled Sign',
        description: sign.description || 'No description available',
        difficulty: getDifficultyLevel(sign.difficulty),
        category: 'other' as const,
        status: 'published' as const,
        tags: [],
        createdAt: sign.created_at,
        updatedAt: sign.created_at,
        createdBy: sign.created_by || '',
        videoUrl: sign.video_url || '',
        landmarks: []
      }));

      setSigns(mappedSigns);
    } catch (err: any) {
      console.error('Error loading signs:', err);
      setError(err.message || 'Failed to load signs');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyLevel = (difficulty: number): 'beginner' | 'intermediate' | 'advanced' => {
    if (difficulty <= 2) return 'beginner';
    if (difficulty <= 4) return 'intermediate';
    return 'advanced';
  };

  const getDifficultyColor = (difficulty: 'beginner' | 'intermediate' | 'advanced') => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
    }
  };

  const getDifficultyStars = (difficulty: 'beginner' | 'intermediate' | 'advanced') => {
    const stars = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 2 : 3;
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-4 h-4 ${i < stars ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  const handleSearch = () => {
    loadSigns();
  };

  const handleSignClick = (sign: ReferenceSign) => {
    if (onSignSelect) {
      onSignSelect(sign.id, sign.name);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading signs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={loadSigns}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {isTeacher() ? 'Manage Signs' : 'Practice Signs'}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Signs
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Levels</option>
              <option value="1">Beginner (1-2)</option>
              <option value="3">Intermediate (3-4)</option>
              <option value="5">Advanced (5)</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Signs Grid */}
      {signs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No signs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isTeacher() 
              ? 'Get started by recording your first reference sign.' 
              : 'No signs are available for practice yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {signs.map((sign) => (
            <div
              key={sign.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
              onClick={() => handleSignClick(sign)}
            >
              {/* Video Thumbnail */}
              <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center">
                {sign.videoUrl ? (
                  <video
                    src={sign.videoUrl}
                    className="w-full h-full object-cover rounded-t-lg"
                    muted
                    preload="metadata"
                  />
                ) : (
                  <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">No video</p>
                  </div>
                )}
              </div>

              {/* Card Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {sign.name}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(sign.difficulty)}`}>
                    {sign.difficulty}
                  </span>
                </div>

                {/* Difficulty Stars */}
                <div className="flex items-center mb-2">
                  {getDifficultyStars(sign.difficulty)}
                  <span className="ml-2 text-sm text-gray-500">
                    {sign.difficulty}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {sign.description}
                </p>

                {/* Action Section */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {new Date(sign.createdAt).toLocaleDateString()}
                  </span>
                  
                  <div className="flex space-x-2">
                    {showEditControls && isTeacher() && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle edit
                          }}
                          className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle delete
                          }}
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    
                    <button className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                      {isTeacher() ? 'View' : 'Practice'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}