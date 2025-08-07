export interface VideoRecorderProps {
  maxDuration?: number; // in seconds
  onRecordingComplete?: (blob: Blob) => void;
  width?: number;
  height?: number;
}

export interface VideoConstraints {
  width: number;
  height: number;
  frameRate: number;
}
