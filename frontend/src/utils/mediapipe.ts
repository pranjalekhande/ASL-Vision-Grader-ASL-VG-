import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let handDetector: HandLandmarker | null = null;

export const initializeMediaPipe = async (): Promise<HandLandmarker> => {
  if (handDetector) {
    return handDetector;
  }

  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    handDetector = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    console.log('MediaPipe HandLandmarker initialized successfully');
    return handDetector;
  } catch (error) {
    console.error('Error initializing MediaPipe:', error);
    throw error;
  }
};