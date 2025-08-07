# ASL Vision Grader - Development Starter Prompt

I need help building an ASL Vision Grader web application. Let's build it one feature at a time, following this sequence:

## Initial Setup
Please help me set up a new project with:
1. React frontend using Vite
2. Supabase integration
3. Basic project structure following the established file organization

## Feature Sequence

### 1. Basic Video Recording (Start Here)
Help me create a simple video recording component that:
- Uses webcam input
- Records 5-7 second clips at 720p/30FPS
- Provides basic recording controls (start/stop)
- Shows video preview
- NO processing or analysis yet, just recording

### 2. MediaPipe Integration
Once video recording works, help me:
- Add MediaPipe Holistic/HandLandmarker
- Extract landmarks from recorded video
- Process every 3rd frame
- Show basic landmark visualization
- NO scoring yet, just detection and visualization

### 3. Data Storage
After landmark detection works, help me:
- Set up Supabase tables for signs and attempts
- Implement basic video upload
- Store landmark data
- Create simple retrieval
- NO real-time features yet

### 4. Basic Scoring
Once storage works, help me:
- Implement DTW algorithm
- Add basic scoring logic
- Calculate simple accuracy metrics
- Show numeric scores
- NO heat-maps yet

### 5. Student Interface
After scoring works, help me:
- Create attempt submission flow
- Show basic feedback
- Display scores
- List previous attempts
- NO teacher features yet

### 6. Visual Feedback
Once student interface works, help me:
- Add heat-map generation
- Implement overlay rendering
- Show visual feedback
- Add basic animations
- NO real-time updates yet

### 7. Teacher Dashboard
After student features work, help me:
- Create teacher view
- Show student list
- Display attempt history
- Add basic analytics
- NO advanced features yet

## Development Approach
- Focus on one feature at a time
- Get basic version working before adding complexity
- Test each component thoroughly
- Keep it simple and maintainable
- Add polish only after core functionality works

## Initial Request
"Let's start with setting up the project and implementing the basic video recording component. Please help me set up a new React project with Vite and create a simple video recording component that can capture 5-7 second clips from the webcam."

This will get us started with the most fundamental feature, and we can build from there.
