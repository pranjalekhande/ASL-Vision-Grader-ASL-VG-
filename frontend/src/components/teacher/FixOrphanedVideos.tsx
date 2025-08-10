import React, { useState } from 'react';
import { supabase } from '../../config/supabase';

interface OrphanedVideo {
  filename: string;
  attemptId: string;
  exists: boolean;
  currentUrl: string | null;
}

export const FixOrphanedVideos: React.FC = () => {
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [orphanedVideos, setOrphanedVideos] = useState<OrphanedVideo[]>([]);

  const scanForOrphanedVideos = async () => {
    setFixing(true);
    setResult('Scanning for orphaned videos...');

    try {
      // Get all video files in storage
      const { data: videoFiles, error: filesError } = await supabase.storage
        .from('videos')
        .list('attempts/video');

      if (filesError) throw filesError;

      // Get all attempts from database
      const { data: attempts, error: attemptsError } = await supabase
        .from('attempts')
        .select('id, video_url, created_at')
        .order('created_at', { ascending: false });

      if (attemptsError) throw attemptsError;

      const orphaned: OrphanedVideo[] = [];

      // Check each video file
      for (const file of videoFiles || []) {
        const attemptId = file.name; // Filename should be the attempt ID
        const attempt = attempts?.find(a => a.id === attemptId);
        
        if (attempt) {
          const expectedUrl = supabase.storage
            .from('videos')
            .getPublicUrl(`attempts/video/${attemptId}`).data.publicUrl;

          orphaned.push({
            filename: file.name,
            attemptId: attemptId,
            exists: !!attempt,
            currentUrl: attempt.video_url
          });
        }
      }

      setOrphanedVideos(orphaned);
      setResult(`Found ${orphaned.length} video files in storage.
${orphaned.filter(v => !v.currentUrl).length} attempts missing video URLs in database.`);

    } catch (error) {
      setResult(`❌ Error scanning: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setFixing(false);
  };

  const fixOrphanedVideos = async () => {
    setFixing(true);
    setResult('Fixing orphaned videos...');

    try {
      let fixed = 0;
      let errors = 0;

      for (const video of orphanedVideos) {
        if (!video.currentUrl) {
          // Generate the correct public URL
          const { data: { publicUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(`attempts/video/${video.attemptId}`);

          // Update the attempt with the video URL
          const { error } = await supabase
            .from('attempts')
            .update({ video_url: publicUrl })
            .eq('id', video.attemptId);

          if (error) {
            console.error(`Failed to update attempt ${video.attemptId}:`, error);
            errors++;
          } else {
            fixed++;
          }
        }
      }

      setResult(`✅ Fix completed!

Fixed: ${fixed} attempts now have video URLs
Errors: ${errors} attempts couldn't be updated
Already OK: ${orphanedVideos.filter(v => v.currentUrl).length} attempts already had URLs

Refresh the teacher dashboard to see the newly available videos!`);

      // Refresh the orphaned videos list
      await scanForOrphanedVideos();

    } catch (error) {
      setResult(`❌ Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setFixing(false);
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-4">
      <h3 className="text-lg font-semibold text-green-900 mb-4">Fix Orphaned Student Videos</h3>
      
      <p className="text-green-800 mb-4">
        This will reconnect uploaded student videos to their database records.
      </p>

      <div className="space-x-3 mb-4">
        <button
          onClick={scanForOrphanedVideos}
          disabled={fixing}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {fixing ? 'Scanning...' : 'Scan for Orphaned Videos'}
        </button>

        {orphanedVideos.length > 0 && (
          <button
            onClick={fixOrphanedVideos}
            disabled={fixing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {fixing ? 'Fixing...' : `Fix ${orphanedVideos.filter(v => !v.currentUrl).length} Orphaned Videos`}
          </button>
        )}
      </div>

      {result && (
        <div className="mt-4 p-4 bg-white rounded border">
          <pre className="text-sm whitespace-pre-wrap">{result}</pre>
        </div>
      )}

      {orphanedVideos.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium text-green-900 mb-2">Found Videos:</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Attempt ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Database URL
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orphanedVideos.map((video) => (
                  <tr key={video.attemptId}>
                    <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                      {video.attemptId.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {video.currentUrl ? (
                        <span className="text-green-600">✓ Has URL</span>
                      ) : (
                        <span className="text-red-600">✗ Missing URL</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {video.currentUrl ? (
                        <span className="text-green-600">Ready</span>
                      ) : (
                        <span className="text-orange-600">Needs Fix</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
