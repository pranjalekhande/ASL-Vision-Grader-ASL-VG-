import { VideoRecorder } from './components/video/VideoRecorder';

function App() {
  const handleRecordingComplete = (blob: Blob) => {
    console.log('Recording completed:', blob);
    // We'll implement upload and processing later
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          ASL Vision Grader
        </h1>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <VideoRecorder
            maxDuration={7}
            onRecordingComplete={handleRecordingComplete}
            width={1280}
            height={720}
          />
        </div>
      </div>
    </div>
  );
}

export default App;