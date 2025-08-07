# ASL Vision Grader (ASL-VG) - Project Structure Guide

## Project Organization

The ASL Vision Grader project follows a clean separation between frontend and backend components, organized for clarity and scalability.

## Root Project Structure

```
asl-vg-project/
│
├── frontend/           # React-based web application
├── backend/           # API server (FastAPI/Express)
├── README.md          # Project overview
├── docker-compose.yml # (Optional) Container orchestration
└── .env.example       # Environment variable templates
```

## Frontend Directory Structure

```
frontend/
│
├── public/              # Static assets
│   ├── index.html
│   └── favicon.ico
│
├── src/
│   ├── components/     # React components
│   │   ├── VideoRecorder.jsx      # Webcam capture
│   │   ├── LandmarkVisualizer.jsx # Feedback overlay
│   │   └── Dashboard.jsx          # User interface
│   │
│   ├── hooks/         # Custom React hooks
│   │   └── useMediaPipe.js        # MediaPipe integration
│   │
│   ├── api/           # API client wrappers
│   │   └── attempts.js            # Backend API calls
│   │
│   ├── App.jsx        # Main application component
│   ├── index.js       # Application entry point
│   │
│   └── styles/        # CSS/styling
│       └── main.css
│
├── package.json       # Dependencies and scripts
└── ... (other config)
```

### Frontend Component Responsibilities

#### `VideoRecorder.jsx`
- Manages webcam access and video recording
- Handles frame extraction (every 3rd frame)
- Integrates with MediaPipe for landmark detection
- Provides recording controls and preview

#### `LandmarkVisualizer.jsx`
- Renders video playback with overlay
- Displays heatmap feedback
- Shows score visualization
- Handles canvas-based drawing

#### `Dashboard.jsx`
- Manages attempt history display
- Provides filtering and sorting
- Shows progress trends
- Handles teacher/student views

#### `useMediaPipe.js`
- Wraps MediaPipe WASM initialization
- Provides landmark extraction hooks
- Handles MediaPipe lifecycle
- Manages resource cleanup

## Backend Directory Structure

```
backend/
│
├── app/
│   ├── routes/        # API endpoints
│   │   └── attempts.py          # Upload/retrieval routes
│   │
│   ├── db/           # Database integration
│   │   └── models.py           # Data models
│   │
│   ├── services/     # Business logic
│   │   ├── scoring.py          # DTW scoring
│   │   └── dtw.py             # DTW algorithm
│   │
│   ├── utils/        # Helper functions
│   │   └── helpers.py
│   │
│   ├── main.py       # Application entry
│   └── config.py     # Configuration
│
├── data/
│   ├── exemplars/    # Reference data
│   │   └── *.json
│   └── seeds.py      # Database seeding
│
├── requirements.txt  # Python dependencies
└── README.md        # Backend documentation
```

### Backend Component Responsibilities

#### Routes (`/app/routes/`)
- Handle HTTP requests
- Validate input data
- Coordinate service calls
- Format responses

#### Services (`/app/services/`)
- Implement business logic
- Process landmarks
- Calculate scores
- Generate feedback

#### Database (`/app/db/`)
- Define data models
- Handle persistence
- Manage relationships
- Provide query interfaces

#### Utils (`/app/utils/`)
- Shared helper functions
- Error handling
- Logging
- Common utilities

## Development Guidelines

### 1. Component Organization
- Keep components focused and single-purpose
- Use meaningful file names that reflect functionality
- Group related files in appropriate directories
- Maintain clear separation of concerns

### 2. Code Structure
- Start with minimal implementations
- Refactor and split files as complexity grows
- Keep modules replaceable and loosely coupled
- Document key functions and interfaces

### 3. Scaling Considerations
- Add new components in appropriate directories
- Maintain consistent naming conventions
- Consider creating subdirectories for feature groups
- Document new additions in README files

### 4. Best Practices
- Don't over-engineer early in development
- Keep initial implementations simple
- Refactor when patterns emerge
- Document decisions and trade-offs

## Adding New Features

When adding new features:

1. **Frontend**
   - Add new components to `/src/components/`
   - Create hooks in `/src/hooks/` if needed
   - Update API clients in `/src/api/`
   - Add styles to `/src/styles/`

2. **Backend**
   - Add routes in `/app/routes/`
   - Create services in `/app/services/`
   - Update models in `/app/db/`
   - Add utilities as needed

## Initial Development Focus

Start with core functionality:

1. Implement basic video recording
2. Add MediaPipe integration
3. Create simple upload endpoint
4. Build basic feedback display

Expand features incrementally based on user feedback and requirements.

## Tips for Development

- Start with minimal viable implementations
- Add complexity only when needed
- Keep modules focused and independent
- Document as you build
- Test components in isolation
- Use meaningful commit messages
- Update documentation regularly

## Future Considerations

As the project grows, consider:

- Breaking out larger features into subdirectories
- Creating shared component libraries
- Implementing proper testing structure
- Adding CI/CD configuration
- Enhancing documentation
- Setting up monitoring and logging
