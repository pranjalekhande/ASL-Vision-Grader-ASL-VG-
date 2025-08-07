import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

let handLandmarkerInstance: HandLandmarker | null = null;

export const initializeMediaPipe = async (): Promise<HandLandmarker> => {
  if (handLandmarkerInstance) {
    return handLandmarkerInstance;
  }

  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    handLandmarkerInstance = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2,
      imageDimensions: { width: 1280, height: 720 },
    });

    return handLandmarkerInstance;
  } catch (error) {
    console.error('Error initializing MediaPipe:', error);
    throw error;
  }
};
