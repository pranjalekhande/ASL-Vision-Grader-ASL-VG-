# ASL Vision Grader (ASL-VG)

A web-based tool for evaluating American Sign Language (ASL) signs using computer vision and providing instant feedback.

## Overview

ASL Vision Grader provides real-time feedback on ASL signing accuracy through:
- Score evaluation (0-100) for handshape, location, and movement
- Visual heat-map overlay showing accuracy in real-time
- Dashboard for students and teachers to track progress

## Features

- 5-7 second video capture at 720p/30FPS
- Real-time landmark detection using MediaPipe
- Dynamic Time Warping (DTW) based scoring
- Visual feedback through heat-map overlays
- Student and teacher dashboards

## Tech Stack

- **Frontend:** React, MediaPipe WASM, HTML5 Canvas
- **Backend:** FastAPI/Python
- **Database:** PostgreSQL with JSONB
- **ML/CV:** MediaPipe Holistic, DTW Algorithm
- **Optional:** GPT-4 for narrative feedback

## Dataset Attribution

This project uses the following open datasets:
- ASLLVD (Boston University) - CC BY-NC-SA
- WLASL - Research only license

For research and educational purposes only. Not for commercial use.

## Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Follow setup instructions in frontend/README.md and backend/README.md

## License

Non-commercial use only. See LICENSE for details.

## Acknowledgments

- Boston University ASL Linguistic Research Project (ASLLVD)
- WLASL Dataset Contributors
- Google MediaPipe Team