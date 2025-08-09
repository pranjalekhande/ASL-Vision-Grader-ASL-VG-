import React from 'react';

interface ModeSelectorProps {
  onModeSelect: (mode: 'teacher' | 'student') => void;
}

export function ModeSelector({ onModeSelect }: ModeSelectorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">ASL Vision Grader</h1>
          <p className="text-lg text-gray-600 mb-8">Choose your mode to continue</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <button
            onClick={() => onModeSelect('teacher')}
            className="group relative flex flex-col items-center p-6 border-2 border-blue-500 rounded-xl hover:bg-blue-50 transition-all duration-300"
          >
            <div className="text-2xl font-bold text-blue-600 mb-2">Teacher Mode</div>
            <p className="text-gray-600 text-center">
              Record reference signs and create practice materials
            </p>
            <div className="mt-4 text-sm text-blue-500">
              • Record reference signs
              <br />
              • Add sign descriptions
              <br />
              • Manage practice content
            </div>
          </button>

          <button
            onClick={() => onModeSelect('student')}
            className="group relative flex flex-col items-center p-6 border-2 border-green-500 rounded-xl hover:bg-green-50 transition-all duration-300"
          >
            <div className="text-2xl font-bold text-green-600 mb-2">Practice Mode</div>
            <p className="text-gray-600 text-center">
              Practice ASL signs and get instant feedback
            </p>
            <div className="mt-4 text-sm text-green-500">
              • Practice signs
              <br />
              • Get instant feedback
              <br />
              • Track your progress
            </div>
          </button>
        </div>

        <p className="text-sm text-gray-500 text-center mt-8">
          Select a mode to begin. You can switch modes at any time.
        </p>
      </div>
    </div>
  );
}

