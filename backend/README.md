# ASL Vision Grader - Backend

## Overview

Backend service for ASL Vision Grader, handling:
- Video upload and landmark processing
- DTW-based scoring algorithm
- Database management
- API endpoints

## Tech Stack

- FastAPI/Python
- PostgreSQL (JSONB for landmark data)
- MediaPipe Holistic
- DTW Algorithm

## Directory Structure

```
backend/
├── app/
│   ├── routes/      # API endpoints
│   ├── db/         # Database models
│   ├── services/   # Business logic
│   └── utils/      # Helper functions
├── data/
│   └── exemplars/  # Reference data
└── requirements.txt
```

## Setup

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up database:
```bash
# Create database and run migrations
```

4. Run development server:
```bash
uvicorn app.main:app --reload
```

## API Endpoints

### POST /api/attempts/upload
Upload video attempt and get feedback

### GET /api/attempts/{student_id}
Get student's attempt history

### GET /api/dashboard/teacher
Get teacher dashboard data

## Database Schema

See `app/db/models.py` for complete schema.