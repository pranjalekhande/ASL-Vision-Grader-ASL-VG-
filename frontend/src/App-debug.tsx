import { useState, useEffect } from 'react';

function App() {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  useEffect(() => {
    const addDebugInfo = (info: string) => {
      console.log(info);
      setDebugInfo(prev => [...prev, `${new Date().toISOString()}: ${info}`]);
    };

    addDebugInfo('App component mounted');

    // Check environment variables
    addDebugInfo(`Supabase URL: ${import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing'}`);
    addDebugInfo(`Supabase Key: ${import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}`);

    // Check if components can be imported
    try {
      import('./components/video/VideoRecorder').then(() => {
        addDebugInfo('VideoRecorder component imported successfully');
      }).catch(err => {
        addDebugInfo(`VideoRecorder import failed: ${err.message}`);
      });
    } catch (err: any) {
      addDebugInfo(`VideoRecorder import error: ${err.message}`);
    }

    return () => {
      addDebugInfo('App component unmounting');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          ASL Vision Grader - Debug Mode
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
          <div className="space-y-2">
            {debugInfo.map((info, index) => (
              <div key={index} className="text-sm font-mono bg-gray-100 p-2 rounded">
                {info}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
