import React, { useState } from 'react';
import { TeacherDashboard } from './TeacherDashboard';
import { EnhancedTeacherDashboard } from './EnhancedTeacherDashboard';

type TeacherView = 'dashboard' | 'video-review';

export function TeacherRouter() {
  const [currentView, setCurrentView] = useState<TeacherView>('dashboard');

  return (
    <div>
      {/* Navigation Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-6">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              📊 Main Dashboard
            </button>
            
            <button
              onClick={() => setCurrentView('video-review')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                currentView === 'video-review'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              🎥 Video Review & Feedback
            </button>
          </div>
          
          {/* Description for current view */}
          <div className="mt-2 text-sm text-gray-600">
            {currentView === 'dashboard' ? (
              'Manage exemplars, view student progress, and class overview'
            ) : (
              'Review student videos with advanced playback controls and provide timestamped feedback'
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {currentView === 'dashboard' && <TeacherDashboard />}
        {currentView === 'video-review' && <EnhancedTeacherDashboard />}
      </div>
    </div>
  );
}
