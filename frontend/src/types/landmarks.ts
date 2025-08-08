import type { HandLandmarkerResult, Landmark, Category } from '@mediapipe/tasks-vision';

export interface TimestampedLandmark extends Landmark {
  timestamp: number;
}

export interface HandLandmarkFrame {
  timestamp: number;
  landmarks: TimestampedLandmark[][];
  handedness: Category[][];
}

export interface RecordingData {
  startTime: number;
  endTime: number;
  duration: number;
  frameRate: number;
  frames: HandLandmarkFrame[];
  metadata: {
    width: number;
    height: number;
    frameCount: number;
  };
}

export interface LandmarkProcessor {
  processFrame: (result: HandLandmarkerResult, timestamp: number) => void;
  getData: () => RecordingData;
  reset: () => void;
}

export class LandmarkDataCollector implements LandmarkProcessor {
  private frames: HandLandmarkFrame[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private frameCount: number = 0;
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public processFrame(result: HandLandmarkerResult, timestamp: number): void {
    if (this.frames.length === 0) {
      this.startTime = timestamp;
    }
    this.endTime = timestamp;
    this.frameCount++;

    const frame: HandLandmarkFrame = {
      timestamp,
      landmarks: result.landmarks.map(handLandmarks =>
        handLandmarks.map(landmark => ({
          ...landmark,
          timestamp
        }))
      ),
      handedness: result.handednesses || []
    };

    this.frames.push(frame);
  }

  public getData(): RecordingData {
    const duration = this.endTime - this.startTime;
    const frameRate = this.frameCount / (duration / 1000); // frames per second

    return {
      startTime: this.startTime,
      endTime: this.endTime,
      duration,
      frameRate,
      frames: this.frames,
      metadata: {
        width: this.width,
        height: this.height,
        frameCount: this.frameCount
      }
    };
  }

  public reset(): void {
    this.frames = [];
    this.startTime = 0;
    this.endTime = 0;
    this.frameCount = 0;
  }
}
