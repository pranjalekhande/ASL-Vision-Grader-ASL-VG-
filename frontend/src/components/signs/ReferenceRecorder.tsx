import React, { useState } from 'react';
import { VideoRecorder } from '../video/VideoRecorder';
import { useReferenceSign } from '../../hooks/useReferenceSign';
import type { CreateSignInput, SignDifficulty, SignCategory } from '../../types/signs';
import type { HandLandmarkFrame } from '../../types/landmarks';

interface ReferenceRecorderProps {
  onComplete?: () => void;
}

export const ReferenceRecorder: React.FC<ReferenceRecorderProps> = ({
  onComplete
}) => {
  const { createSign, isLoading, error } = useReferenceSign();
  const [metadata, setMetadata] = useState({
    name: '',
    description: '',
    difficulty: 'beginner' as SignDifficulty,
    category: 'other' as SignCategory,
    tags: [] as string[]
  });
  const [currentTag, setCurrentTag] = useState('');
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [landmarks, setLandmarks] = useState<HandLandmarkFrame[]>([]);

  const handleRecordingComplete = (blob: Blob, recordedLandmarks: HandLandmarkFrame[]) => {
    console.log('ReferenceRecorder: handleRecordingComplete called', { blob, recordedLandmarks: recordedLandmarks.length });
    setVideoBlob(blob);
    setLandmarks(recordedLandmarks);
    setRecordingComplete(true);
    console.log('ReferenceRecorder: recordingComplete set to true');
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !metadata.tags.includes(currentTag.trim())) {
      setMetadata(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setMetadata(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoBlob) return;

    const input: CreateSignInput = {
      ...metadata,
      videoBlob,
      landmarks
    };

    try {
      await createSign(input);
      onComplete?.();
    } catch (error) {
      console.error('Failed to create sign:', error);
    }
  };

  console.log('ReferenceRecorder render:', { recordingComplete, hasVideoBlob: !!videoBlob, landmarksCount: landmarks.length });

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Record Reference Sign</h2>

      {!recordingComplete ? (
        <VideoRecorder onRecordingComplete={handleRecordingComplete} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
              <input
                type="text"
                value={metadata.name}
                onChange={e => setMetadata(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
              <textarea
                value={metadata.description}
                onChange={e => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                rows={3}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Difficulty
                <select
                  value={metadata.difficulty}
                  onChange={e => setMetadata(prev => ({
                    ...prev,
                    difficulty: e.target.value as SignDifficulty
                  }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category
                <select
                  value={metadata.category}
                  onChange={e => setMetadata(prev => ({
                    ...prev,
                    category: e.target.value as SignCategory
                  }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="alphabet">Alphabet</option>
                  <option value="numbers">Numbers</option>
                  <option value="common_phrases">Common Phrases</option>
                  <option value="greetings">Greetings</option>
                  <option value="emotions">Emotions</option>
                  <option value="colors">Colors</option>
                  <option value="time">Time</option>
                  <option value="family">Family</option>
                  <option value="food">Food</option>
                  <option value="animals">Animals</option>
                  <option value="weather">Weather</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tags
              <div className="mt-1 flex space-x-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={e => setCurrentTag(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Add a tag"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Add
                </button>
              </div>
            </label>

            <div className="mt-2 flex flex-wrap gap-2">
              {metadata.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 inline-flex items-center p-0.5 hover:bg-blue-200 rounded-full"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              {error.message}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setRecordingComplete(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Record Again
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Reference Sign'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};


