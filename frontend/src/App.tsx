import { useState } from 'react';
import { VideoRecorder } from './components/video/VideoRecorder';
import { StorageTest } from './components/test/StorageTest';

function App() {
  const [showStorageTest, setShowStorageTest] = useState(false);

  const handleRecordingComplete = async (blob: Blob) => {
    console.log('Recording completed:', blob);
    // We'll implement upload and processing later
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            ASL Vision Grader
          </h1>
          <button
            onClick={() => setShowStorageTest(prev => !prev)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            {showStorageTest ? 'Show Recorder' : 'Test Storage'}
          </button>
        </div>

        {showStorageTest ? (
          <StorageTest />
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6">
            <VideoRecorder
              maxDuration={7}
              onRecordingComplete={handleRecordingComplete}
              width={1280}
              height={720}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;