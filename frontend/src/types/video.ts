export interface VideoRecorderProps {
  maxDuration?: number;
  onRecordingComplete?: (blob: Blob, landmarks: import('./landmarks').HandLandmarkFrame[]) => void;
  width?: number;
  height?: number;
}

export interface VideoConstraints {
  width: number;
  height: number;
  frameRate: number;
}