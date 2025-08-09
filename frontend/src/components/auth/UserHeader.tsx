import React from 'react';
import { useAuth2FA } from '../../hooks/useAuth2FA';

export function UserHeader() {
  const { user, profile, signOut, loading } = useAuth2FA();

  if (loading || !user) return null;

  const role = profile?.role || 'student';
  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User';

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              ASL Vision Grader
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">
                {displayName}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                role === 'teacher' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {role}
              </span>
            </div>
            
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
