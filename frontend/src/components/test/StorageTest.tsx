import { useState } from 'react';
import { supabase } from '../../config/supabase';

interface TestResult {
  type: 'video' | 'landmark';
  status: 'success' | 'error';
  url?: string;
  error?: string;
}

export function StorageTest() {
  const [results, setResults] = useState<TestResult[]>([]);

  // Test video upload
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Upload video
      const fileName = `test-video-${Date.now()}.${file.name.split('.').pop()}`;
      console.log('Uploading video:', fileName);

      const { data: videoData, error: videoError } = await supabase.storage
        .from('videos')
        .upload(fileName, file);

      if (videoError) throw videoError;

      // Get video URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      setResults(prev => [...prev, {
        type: 'video',
        status: 'success',
        url: publicUrl
      }]);

    } catch (err) {
      console.error('Video upload error:', err);
      setResults(prev => [...prev, {
        type: 'video',
        status: 'error',
        error: err instanceof Error ? err.message : 'Video upload failed'
      }]);
    }
  };

  // Test landmark data upload
  const handleLandmarkTest = async () => {
    try {
      // Create sample landmark data
      const sampleData = {
        timestamp: Date.now(),
        landmarks: [
          { x: 0.5, y: 0.5, z: 0 },
          { x: 0.6, y: 0.6, z: 0 }
        ]
      };

      const fileName = `test-landmarks-${Date.now()}.json`;
      console.log('Uploading landmarks:', fileName);

      const { data: landmarkData, error: landmarkError } = await supabase.storage
        .from('landmarks')
        .upload(fileName, JSON.stringify(sampleData), {
          contentType: 'application/json'
        });

      if (landmarkError) throw landmarkError;

      // Get landmark URL
      const { data: { publicUrl } } = supabase.storage
        .from('landmarks')
        .getPublicUrl(fileName);

      setResults(prev => [...prev, {
        type: 'landmark',
        status: 'success',
        url: publicUrl
      }]);

    } catch (err) {
      console.error('Landmark upload error:', err);
      setResults(prev => [...prev, {
        type: 'landmark',
        status: 'error',
        error: err instanceof Error ? err.message : 'Landmark upload failed'
      }]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">Storage Tests</h2>

        {/* Video Upload Test */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Test Video Upload</h3>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        {/* Landmark Upload Test */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Test Landmark Upload</h3>
          <button
            onClick={handleLandmarkTest}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Upload Sample Landmarks
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Test Results</h3>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-md ${
                    result.status === 'success'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">
                        {result.type === 'video' ? 'Video Upload' : 'Landmark Upload'}
                      </span>
                      <span
                        className={`ml-2 px-2 py-1 text-xs rounded ${
                          result.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {result.status.toUpperCase()}
                      </span>
                    </div>
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View File
                      </a>
                    )}
                  </div>
                  {result.error && (
                    <p className="mt-2 text-sm text-red-600">{result.error}</p>
                  )}
                  {result.url && result.type === 'video' && (
                    <video
                      src={result.url}
                      controls
                      className="mt-4 w-full rounded"
                      style={{ maxHeight: '200px' }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}