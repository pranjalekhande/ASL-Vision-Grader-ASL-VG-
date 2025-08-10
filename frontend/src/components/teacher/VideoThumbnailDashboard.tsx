import React, { useState, useEffect, useMemo } from 'react';
import { VideoThumbnail } from './VideoThumbnail';
import { ScoreTrendChart } from './ScoreTrendChart';
import { preloadThumbnails } from '../../utils/thumbnailGenerator';

interface VideoFilters {
  student: string;
  sign: string;
  dateRange: 'all' | 'week' | 'month' | '3months';
  scoreRange: 'all' | 'high' | 'medium' | 'low';
  hasVideo: boolean;
  hasFeedback: boolean;
}

interface VideoThumbnailDashboardProps {
  attempts: any[];
  onAttemptSelect: (attempt: any) => void;
  loading?: boolean;
  showTrendChart?: boolean;
  gridSize?: 'small' | 'medium' | 'large';
}

export const VideoThumbnailDashboard: React.FC<VideoThumbnailDashboardProps> = ({
  attempts = [],
  onAttemptSelect,
  loading = false,
  showTrendChart = true,
  gridSize = 'medium'
}) => {
  const [filters, setFilters] = useState<VideoFilters>({
    student: 'all',
    sign: 'all',
    dateRange: 'all',
    scoreRange: 'all',
    hasVideo: true,
    hasFeedback: false
  });
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'student' | 'sign'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  
  const itemsPerPage = gridSize === 'small' ? 20 : gridSize === 'medium' ? 12 : 8;

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const students = [...new Set(attempts.map(a => a.student_name).filter(Boolean))].sort();
    const signs = [...new Set(attempts.map(a => a.sign_name).filter(Boolean))].sort();
    
    return { students, signs };
  }, [attempts]);

  // Filter and sort attempts
  const filteredAttempts = useMemo(() => {
    let filtered = attempts.filter(attempt => {
      // Student filter
      if (filters.student !== 'all' && attempt.student_name !== filters.student) {
        return false;
      }

      // Sign filter
      if (filters.sign !== 'all' && attempt.sign_name !== filters.sign) {
        return false;
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        const attemptDate = new Date(attempt.created_at);
        const now = new Date();
        const daysDiff = (now.getTime() - attemptDate.getTime()) / (1000 * 60 * 60 * 24);
        
        switch (filters.dateRange) {
          case 'week':
            if (daysDiff > 7) return false;
            break;
          case 'month':
            if (daysDiff > 30) return false;
            break;
          case '3months':
            if (daysDiff > 90) return false;
            break;
        }
      }

      // Score range filter
      if (filters.scoreRange !== 'all') {
        const hasScores = attempt.score_shape !== null && attempt.score_location !== null && attempt.score_movement !== null;
        if (!hasScores) return false;
        
        const avgScore = (attempt.score_shape + attempt.score_location + attempt.score_movement) / 3;
        switch (filters.scoreRange) {
          case 'high':
            if (avgScore < 80) return false;
            break;
          case 'medium':
            if (avgScore < 60 || avgScore >= 80) return false;
            break;
          case 'low':
            if (avgScore >= 60) return false;
            break;
        }
      }

      // Video filter
      if (filters.hasVideo && !attempt.video_url) {
        return false;
      }

      // Feedback filter
      if (filters.hasFeedback && (!attempt.feedback_count || attempt.feedback_count === 0)) {
        return false;
      }

      // Search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesStudent = attempt.student_name?.toLowerCase().includes(searchLower);
        const matchesSign = attempt.sign_name?.toLowerCase().includes(searchLower);
        if (!matchesStudent && !matchesSign) {
          return false;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'score':
          aValue = a.score_shape && a.score_location && a.score_movement 
            ? (a.score_shape + a.score_location + a.score_movement) / 3 
            : 0;
          bValue = b.score_shape && b.score_location && b.score_movement 
            ? (b.score_shape + b.score_location + b.score_movement) / 3 
            : 0;
          break;
        case 'student':
          aValue = a.student_name || '';
          bValue = b.student_name || '';
          break;
        case 'sign':
          aValue = a.sign_name || '';
          bValue = b.sign_name || '';
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [attempts, filters, sortBy, sortOrder, searchTerm]);

  // Paginated attempts
  const paginatedAttempts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAttempts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAttempts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAttempts.length / itemsPerPage);

  // Preload thumbnails for visible attempts
  useEffect(() => {
    const videoUrls = paginatedAttempts
      .map(attempt => attempt.video_url)
      .filter(Boolean)
      .filter(url => {
        try {
          new URL(url);
          return true;
        } catch {
          console.warn('Invalid video URL found in attempt:', attempt.id, 'URL:', url);
          return false;
        }
      });
    
    if (videoUrls.length > 0) {
      preloadThumbnails(videoUrls, {
        width: gridSize === 'small' ? 160 : gridSize === 'medium' ? 200 : 240,
        height: gridSize === 'small' ? 120 : gridSize === 'medium' ? 150 : 180
      });
    }
  }, [paginatedAttempts, gridSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm, sortBy, sortOrder]);

  const handleFilterChange = (key: keyof VideoFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      student: 'all',
      sign: 'all',
      dateRange: 'all',
      scoreRange: 'all',
      hasVideo: true,
      hasFeedback: false
    });
    setSearchTerm('');
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton filters */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-300 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Skeleton grid */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className={`grid gap-6 ${
            gridSize === 'small' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' :
            gridSize === 'medium' ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4' :
            'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {Array.from({ length: itemsPerPage }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-300 rounded-lg aspect-video mb-3"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Video Review Dashboard</h2>
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-gray-300">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 text-sm rounded-l-lg ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm rounded-r-lg ${
                  viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                List
              </button>
            </div>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search students or signs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Student Filter */}
          <select
            value={filters.student}
            onChange={(e) => handleFilterChange('student', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Students</option>
            {filterOptions.students.map(student => (
              <option key={student} value={student}>{student}</option>
            ))}
          </select>

          {/* Sign Filter */}
          <select
            value={filters.sign}
            onChange={(e) => handleFilterChange('sign', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Signs</option>
            {filterOptions.signs.map(sign => (
              <option key={sign} value={sign}>{sign}</option>
            ))}
          </select>

          {/* Date Range */}
          <select
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="3months">Past 3 Months</option>
          </select>

          {/* Score Range */}
          <select
            value={filters.scoreRange}
            onChange={(e) => handleFilterChange('scoreRange', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Scores</option>
            <option value="high">High (80%+)</option>
            <option value="medium">Medium (60-79%)</option>
            <option value="low">Low (&lt;60%)</option>
          </select>
        </div>

        {/* Toggle Filters */}
        <div className="flex items-center space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasVideo}
              onChange={(e) => handleFilterChange('hasVideo', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Has Video</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hasFeedback}
              onChange={(e) => handleFilterChange('hasFeedback', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Has Feedback</span>
          </label>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Sort by:</span>
            <button
              onClick={() => toggleSort('date')}
              className={`text-sm ${sortBy === 'date' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => toggleSort('score')}
              className={`text-sm ${sortBy === 'score' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Score {sortBy === 'score' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => toggleSort('student')}
              className={`text-sm ${sortBy === 'student' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Student {sortBy === 'student' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => toggleSort('sign')}
              className={`text-sm ${sortBy === 'sign' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Sign {sortBy === 'sign' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          <div className="text-sm text-gray-600">
            {filteredAttempts.length} of {attempts.length} attempts
          </div>
        </div>
      </div>

      {/* Score Trend Chart */}
      {showTrendChart && filteredAttempts.length > 0 && (
        <ScoreTrendChart
          attempts={filteredAttempts}
          onPointClick={onAttemptSelect}
          height={200}
          showLegend={true}
        />
      )}

      {/* Attempts Grid/List */}
      <div className="bg-white rounded-lg shadow">
        {filteredAttempts.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No attempts found</h3>
            <p className="text-gray-600">Try adjusting your filters to see more results</p>
          </div>
        ) : (
          <>
            <div className="p-6">
              <div className={`grid gap-6 ${
                viewMode === 'grid' ? (
                  gridSize === 'small' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' :
                  gridSize === 'medium' ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4' :
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                ) : 'grid-cols-1'
              }`}>
                {paginatedAttempts.map(attempt => (
                  <VideoThumbnail
                    key={attempt.id}
                    attempt={attempt}
                    onClick={onAttemptSelect}
                    showLandmarks={false}
                    size={viewMode === 'list' ? 'small' : gridSize}
                  />
                ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
