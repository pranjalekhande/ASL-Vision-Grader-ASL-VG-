export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HandLandmarkerResult {
  landmarks: Landmark[][];
  handedness: string[];
}
