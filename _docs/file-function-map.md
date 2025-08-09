# File to Function Mapping

## Frontend Components

### `src/App.tsx`
- Main application component
- Renders VideoRecorder

### `src/components/video/VideoRecorder.tsx`
- `VideoRecorder`: Main component for video capture and landmark detection
- Handles recording state
- Manages video preview
- Controls landmark visualization
- Integrates with upload system

### `src/components/landmarks/LandmarkViewer.tsx`
- `LandmarkViewer`: Visualizes recorded hand landmarks
- `drawFrame`: Renders landmarks on canvas
- Handles playback controls
- Shows metadata display

### `src/components/upload/UploadProgress.tsx`
- `UploadProgress`: Shows upload status
- Displays progress bars
- Shows success/error states

## Hooks

### `src/hooks/useVideoRecorder.ts`
- `useVideoRecorder`: Manages video recording
- `startRecording`: Starts video capture
- `stopRecording`: Stops video capture
- Handles MediaRecorder API

### `src/hooks/useMediaPipe.ts`
- `useMediaPipe`: MediaPipe integration
- `initializeMediaPipe`: Sets up hand detection
- `detectLandmarks`: Processes video frames
- Manages detection state

### `src/hooks/useUpload.ts`
- `useUpload`: Manages file uploads
- `upload`: Handles file upload process
- `reset`: Resets upload state
- Tracks upload progress

## Services

### `src/services/uploadService.ts`
- `UploadService.uploadRecording`: Handles video/landmark upload
- `UploadService.uploadWithRetry`: Retries failed uploads
- `UploadService.getLandmarkData`: Fetches landmark data

## Types

### `src/types/video.ts`
- `VideoRecorderProps`: Props for VideoRecorder
- `VideoConstraints`: Video configuration types

### `src/types/landmarks.ts`
- `TimestampedLandmark`: Landmark with timestamp
- `HandLandmarkFrame`: Frame data structure
- `RecordingData`: Complete recording data
- `LandmarkDataCollector`: Collects landmark data

### `src/types/supabase.ts`
- Database types for Supabase
- Storage bucket types
- Upload result types

## Utils

### `src/utils/mediapipe.ts`
- `initializeMediaPipe`: MediaPipe setup
- Hand detector configuration

## Configuration

### `src/config/supabase.ts`
- Supabase client configuration
- Environment variable handling
