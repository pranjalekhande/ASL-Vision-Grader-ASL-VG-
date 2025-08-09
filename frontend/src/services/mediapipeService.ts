import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision';

/**
 * MediaPipeService is a singleton wrapper around HandLandmarker with
 * reference-counted acquire/release and HMR-safe cleanup.
 */
class MediaPipeService {
  private handLandmarker: HandLandmarker | null = null;
  private initializing: Promise<HandLandmarker> | null = null;
  private refCount = 0;

  public get isReady(): boolean {
    return this.handLandmarker !== null;
  }

  public async acquire(): Promise<void> {
    this.refCount += 1;
    if (this.handLandmarker) return;

    if (!this.initializing) {
      this.initializing = this.initialize();
    }

    this.handLandmarker = await this.initializing;
  }

  public async release(): Promise<void> {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount === 0) {
      await this.close();
    }
  }

  public async detect(video: HTMLVideoElement, timestamp: number): Promise<HandLandmarkerResult | null> {
    if (!this.handLandmarker) return null;
    try {
      return this.handLandmarker.detectForVideo(video, timestamp);
    } catch {
      return null;
    }
  }

  private async initialize(): Promise<HandLandmarker> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    const modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    return lm;
  }

  private async close(): Promise<void> {
    if (this.handLandmarker) {
      try {
        await this.handLandmarker.close();
      } catch {}
      this.handLandmarker = null;
    }
    this.initializing = null;
  }
}

export const mediaPipeService = new MediaPipeService();

if (import.meta && (import.meta as any).hot) {
  (import.meta as any).hot.dispose(async () => {
    await mediaPipeService['close']?.();
  });
}

export type { HandLandmarkerResult };


