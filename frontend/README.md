# ASL Vision Grader - Frontend

## Overview

React-based frontend for ASL Vision Grader, providing:
- Video recording interface
- Real-time landmark visualization
- Score and feedback display
- Student/Teacher dashboards

## Tech Stack

- React
- MediaPipe WASM
- HTML5 Canvas
- WebSocket (optional real-time features)

## Directory Structure

```
frontend/
├── public/         # Static assets
├── src/
│   ├── components/ # React components
│   ├── hooks/     # Custom React hooks
│   ├── api/       # API client
│   └── styles/    # CSS/styling
└── package.json
```

## Key Components

### VideoRecorder
- Webcam capture (720p/30FPS)
- Frame extraction
- MediaPipe integration

### LandmarkVisualizer
- Video playback
- Heat-map overlay
- Score visualization

### Dashboard
- Attempt history
- Progress tracking
- Teacher view (if applicable)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm start
```

## Development Notes

- MediaPipe WASM must be loaded before use
- Canvas overlay requires careful frame timing
- WebSocket optional for real-time features