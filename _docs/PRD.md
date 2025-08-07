# Product Requirements Document (PRD) – ASL Vision Grader (ASL‑VG)

## 1. **Overview**
**ASL Vision Grader (ASL‑VG)** is a web-based tool that allows students to upload 5-second videos of themselves signing American Sign Language (ASL) words. The system scores the accuracy of their handshape, location, and movement, and provides instant visual feedback via a heat-map overlay. Teachers get an overview dashboard where they can view each student's attempts and progress over time.

## 2. **Goal and Problem Statement**
- **Goal:** Improve student ASL proficiency by delivering real-time, actionable feedback on their signing using open-source computer vision tools and open-access datasets (e.g., ASLLVD, WLASL).
- **Problem:** Most ASL learners lack instant, detailed feedback outside live coaching. Teachers need a scalable way to monitor and review student progress.

## 3. **User Personas & Use Cases**
### **Users**
- **Student:** Wants to practice ASL signs and receive immediate, visual correction (on-screen overlays showing mistakes).
- **Teacher:** Wants to track and review each student's sign attempts, review scores, and trends over time.

### **Key Use Cases**
| Persona  | Story | Acceptance Criteria |
|----------|-------|---------------------|
| Student  | "After recording my sign, I instantly see green/red overlays on my hands showing correctness." | Feedback (overlay and scores) appears ≤ 3 seconds after upload. |
| Teacher  | "I see a dashboard with each attempt thumbnail and score trend over time." | Hovering/clicking plays attempts with overlay; clear trend visualization. |
| Student  | "Can review my past attempts along with feedback." | Personal attempt history is accessible and sortable. |
| Teacher  | "I can see best/worst per sign, per student." | Dashboard allows filtering/sorting by sign/student. |

## 4. **Functional Requirements**
### **Recording & Upload**
- Webcam-based video recording, 5–7 seconds, 30 FPS, 720p.
- Client-side frame extraction (every 3rd frame).
- Client-side inference with MediaPipe Holistic/HandLandmarker via WASM.
- Upload of extracted landmark data and original video.

### **Scoring & Feedback**
- Server-side: Compare student landmarks to exemplar via Dynamic Time Warping (DTW).
- Calculate per-dimension errors, aggregate into handshape, location, and movement scores (0–100).
- Generate a per-frame heat-map (green = good, red = error).
- Optional: LLM-generated human-readable feedback.

## 9. **Dashboard Functionality**

### **Student Dashboard**

**Purpose:**
- Allows students to review their signing attempts, get instant visual feedback, and track progress over time.

**Features:**
- List of attempt videos with dates, sign names, and score summaries
- Video playback with heatmap overlays highlighting correctness
- Numerical scores for handshape, location, and movement
- Trend charts to visualize improvement or difficulty areas
- Filters to search/sort attempts by sign or date

**User Flow:**
1. Student logs in and views a list of previous attempts
2. Selects an attempt to watch with heatmap overlay and detailed scores
3. Analyzes trend charts to understand progress
4. Can record new attempts directly from the dashboard

### **Teacher Dashboard**

**Purpose:**
- Helps teachers monitor multiple students' progress and identify those needing extra support.

**Features:**
- Student roster with aggregate scores and recent activity
- Thumbnails of recent sign attempts per student with scores
- Hover to preview video clips with heatmap overlays
- Detailed drilldown view for attempts
- Filters for signs, dates, and score thresholds to identify issues
- Exportable summary reports for class-wide performance

**User Flow:**
1. Teacher logs in to see all supervised students
2. Selects a student to view recent attempts with visual feedback
3. Uses filters to find struggling students or challenging signs
4. Examines trend charts and exports reports as needed

### **Dashboard Architecture Diagram**
```
Student/Teacher Browser
          |
          |--- Requests attempts and scores from Backend API
          |
Backend API Server
     |            |
 Attempts DB   Exemplars DB
     |            |
 Sends JSON data: metadata, scores, heatmaps
          |
 Student/Teacher Browser renders:
 - Video playback with heatmap overlay (Canvas)
 - Score summaries and trend charts
 - Filtering and interactive controls
```

### **Persistence & Security**
- Store all attempts, scores, heatmap data, and videos in Postgres.
- Ensure correct dataset licensing and restrict usage to non-commercial/demo in README, and user agreement screens.

## 5. **Non-functional Requirements**
- **Latency:** End-to-end feedback ≤ 3 s for 80% of attempts.
- **Scalability:** Landmark extraction runs in browser, minimizing server load.
- **Accessibility:** Keyboard-navigable UI, "captioned" corrective overlays for HOH students.

## 6. **Architecture Overview**

### **System Diagram**
```
                  +-------------------+
                  |  Student Device   |
                  +-------------------+
                   | 1. Capture Video
                   v
+-------------------------------+ 2. Extract Landmarks with MediaPipe
|        Browser (WASM)         |---------------------------+
+-------------------------------+                           |
                   | 3. Upload [Landmarks, Video]           |
                   v                                        |
              /------API Gateway------\                     |
             |                        |                     |
        +---------+             +-----------+               |
        | Backend |----DTW----->|  Postgres |<--+ Exemplars |
        +---------+ (Scoring)   +-----------+   |   Store   |
             |      4. Score + Heatmap           +----------+
             |      5. Respond to client		
             v
        +--------+
        |  UI    |
        +--------+
        (Visual Feedback, Dashboard)
```

## 7. **Data & Open Source References**

### **Datasets**
- [ASLLVD — Boston University](https://www.bu.edu/asllrp/av/dai-asllvd.html), ~3,300 signs, CC BY-NC-SA.
- [WLASL — Kaggle](https://www.kaggle.com/datasets/risangbaskoro/wlasl-processed), ~2,000 words, research-only license.

### **Vision/AI Models**
- [MediaPipe Holistic/HandLandmarker (Google AI)](https://ai.google.dev/edge/mediapipe/solutions/vision/holistic_landmarker)

### **Further Reading**
- [Dynamic Time Warping (DTW)](https://en.wikipedia.org/wiki/Dynamic_time_warping)
- [PostgreSQL JSONB Docs](https://www.postgresql.org/docs/current/datatype-json.html)
- [Open Source Licensing and Compliance](https://choosealicense.com/)

## 8. **Minimal Data Model**
```sql
CREATE TABLE signs (
  id UUID PRIMARY KEY,
  gloss TEXT,
  exemplar_landmarks JSONB   -- [[543 floats] x N frames]
);

CREATE TABLE attempts (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students,
  sign_id UUID REFERENCES signs,
  score_shape REAL,
  score_location REAL,
  score_movement REAL,
  heatmap JSONB,
  video_url TEXT,
  created_at TIMESTAMPTZ
);
```

## 10. **MVP Success Criteria**
- A student can upload a sign video and see instant, visual feedback (≤ 3 s).
- Teacher can log in, view all attempts, and observe students' progress.
- All data stored in Postgres; all network/API flows protected and logged.
- All licensing restrictions respected and correctly disclosed.

## 11. **Questions for Stakeholders**
To finalize the PRD and avoid overbuilding or misunderstanding:
1. **Which signs should be prioritized for initial exemplars?**
2. **What is the minimum set of feedback that is actionable for students (e.g., do we also need text, or is overlay sufficient)?**
3. **How will teachers and students be authenticated (if at all, for prototype)?**
4. **Who will provide the first batch of labeled "correct" videos, or should these be seeded from ASLLVD/WLASL?**
5. **Accessibility: Do users need audio or text cueing for errors, or is color overlay sufficient?**
6. **Demo Day: Is public video storage/distribution okay, or are there privacy requirements?**

## 12. **Next Steps / Task Breakdown**
- **Stakeholder sign-off** on key questions above.
- Define exemplar set and seed database.
- Implement client module for video recording/extraction and landmark inference in-browser.
- Build backend `/api/attempts/upload`, with DTW-based scorer and Postgres writes.
- Hook up instructor dashboard and feedback overlay renderer.
- Test for latency and usability; profile with synthetic and real user data.

## 13. **Appendix: Additional Resources**
- [MediaPipe Holistic Guide](https://developers.google.com/mediapipe/solutions/vision/holistic)
- [OpenSLR: Open Speech and Language Resources](http://www.openslr.org/)
- [CC BY-NC-SA License Guide](https://creativecommons.org/licenses/by-nc-sa/4.0/)

## 14. **Step-by-Step Implementation Plan**

### **1. Setup Development Environment**
- Initialize separate repositories or folders for frontend and backend
- Configure basic project setup: React app for frontend, FastAPI or Express for backend
- Establish version control (Git), basic README, and build scripts
- **Outcome:** Independent frontend and backend projects ready for development

### **2. Video Recording and Frame Extraction (Frontend)**
- Build a simple React component to capture 5–7 second videos via webcam (MediaRecorder API)
- Extract every 3rd frame from recorded videos
- **Outcome:** Clean, tested frontend module for video capture and frame extraction, no server dependency

### **3. MediaPipe Holistic WASM Integration (Frontend)**
- Add MediaPipe Holistic/HandLandmarker in-browser to run on extracted frames
- Output landmarks per frame as JSON
- **Outcome:** Frontend produces landmark data reliably without backend interaction

### **4. Upload API Endpoint Design (Backend)**
- Create `/api/attempts/upload` POST route handling JSON payload of landmarks and video metadata
- Validate inputs and respond with placeholders
- **Outcome:** Backend endpoint ready for integration with frontend upload; independent from scoring logic

### **5. Frontend-Backend Integration**
- Connect frontend upload to backend upload endpoint
- Confirm successful round-trip and show confirmation/UI feedback on frontend
- **Outcome:** End-to-end data flow established from client capture to backend endpoint

### **6. Exemplar Data Management (Backend)**
- Load exemplar landmark JSON data from disk or DB into backend service
- Independent example endpoint to return exemplar metadata or a list
- **Outcome:** Backend manages exemplar data, no dependencies on scoring or frontend

### **7. DTW Scoring Algorithm Implementation (Backend)**
- Develop service to compare incoming landmarks against exemplars using DTW
- Independently test with saved landmark JSON files
- **Outcome:** Reliable, tested scoring module isolated from API or frontend layers

### **8. Scoring Integration**
- Integrate DTW scoring into `/api/attempts/upload` to output scores and heatmap data
- Return scoring results in API response
- **Outcome:** Full backend upload-to-score flow working standalone

### **9. Database Integration**
- Design DB schema (signs, attempts) and implement insert logic
- Test DB persistence separately
- **Outcome:** Reliable storage of attempt data, enabling later retrieval

### **10. Frontend Feedback Visualization**
- Develop video playback component with HTML5 Canvas overlay for heatmaps
- Display numeric scores and colored heatmaps on recorded attempts
- **Outcome:** Frontend provides rich, visual feedback based on backend API data

### **11. Student Dashboard Implementation**
- Build UI for students to view their past attempts with thumbnails, dates, and scores
- Fetch data from backend student attempts API
- **Outcome:** Independent frontend dashboard interface connected to backend retrieval APIs

### **12. Teacher Dashboard Implementation**
- Create UI for teachers to view student lists, attempts thumbnails, score trends
- Fetch and filter data via backend APIs
- **Outcome:** Teacher dashboard works independently of student dashboard

### **13. Performance Optimization**
- Add pagination, filtering to backend APIs
- Optimize frontend components (charts, overlays) for performance
- **Outcome:** Scalable and performant system ready for multiple users

### **14. LLM Integration (Optional)**
- Integrate GPT-4 (or similar) for converting numeric deltas into human-readable corrections
- Expose via a separate API endpoint or augment scoring response
- **Outcome:** Enhanced feedback module that can be opted into without touching core flow

## 15. **Development Timeline**

### Phase 1: Foundation (Weeks 1-2)
- Set up development environment and project structure
- Implement basic video recording and frame extraction
- Set up PostgreSQL database with initial schema
- Create basic API endpoints structure

### Phase 2: Core Features (Weeks 3-4)
- Implement MediaPipe integration for landmark extraction
- Develop DTW-based scoring algorithm
- Create basic feedback visualization system
- Set up authentication system

### Phase 3: UI/UX Development (Weeks 5-6)
- Build student upload interface
- Develop feedback overlay system
- Create teacher dashboard
- Implement basic analytics and progress tracking

### Phase 4: Testing & Refinement (Weeks 7-8)
- Comprehensive testing with real users
- Performance optimization
- Security audit and improvements
- Documentation and deployment preparation

## 14. **Technical Stack**

### Frontend
- React.js with TypeScript
- TailwindCSS for styling
- MediaPipe WASM for client-side processing
- Chart.js for analytics visualization

### Backend
- Node.js with Express
- PostgreSQL with TypeORM
- JWT for authentication
- AWS S3 for video storage

### Infrastructure
- Docker for containerization
- AWS for hosting
- GitHub Actions for CI/CD
- Sentry for error tracking

## 15. **Monitoring & Analytics**
- Application performance monitoring
- User engagement metrics
- Error tracking and reporting
- Usage statistics for different features

## 16. **Security Considerations**
- Secure video storage and access
- User data protection
- API rate limiting
- Input validation and sanitization
- CORS and CSP policies

## 17. **Storage & Infrastructure Strategy**

### 17.1 Supabase Integration

#### Why Supabase?
- Native PostgreSQL with JSONB support for landmarks
- Built-in real-time capabilities for dashboard updates
- Integrated storage solution
- Authentication and Row Level Security
- Matches development timeline and initial scale

#### Core Features Utilization
1. **Database**
   - PostgreSQL with JSONB for landmarks
   - Real-time subscriptions for dashboard
   - Row Level Security for data access

2. **Authentication**
   - Student/Teacher role management
   - Secure access control
   - Session management

3. **Storage**
   - Video temporary storage
   - Landmark data persistence
   - Secure file access

4. **Edge Functions**
   - Landmark processing
   - Score calculations
   - Automated cleanup

### 17.2 Video Storage Strategy

#### Storage Architecture
```
storage/
├── temp/
│   └── attempts/
│       ├── {student_id}/
│       │   └── {attempt_id}.mp4    # Deleted after 24h
│       └── processing/             # During processing
├── permanent/
│   ├── exemplars/
│   │   └── {sign_id}.mp4          # Reference videos
│   └── archived/
│       └── {student_id}/          # Selected important attempts
└── landmarks/
    ├── attempts/
    │   └── {attempt_id}.json      # Permanent landmark data
    └── exemplars/
        └── {sign_id}.json         # Reference landmarks
```

#### Video Handling Flow
1. **Upload Phase**
   - Client uploads 720p/30FPS video (5-7 seconds)
   - Estimated size: 2-3MB per video
   - Temporary storage in Supabase

2. **Processing Phase**
   - Extract landmarks
   - Process and score
   - Store landmarks in JSONB
   - Keep video for immediate review

3. **Cleanup Phase**
   - Automated cleanup after 24 hours
   - Archive important videos if needed
   - Maintain only landmark data long-term

#### Storage Optimization
- Client-side compression
- Selective archival
- CDN for exemplars
- Caching strategy

#### Security Measures
```sql
-- Storage access control
CREATE POLICY "Students can access own videos"
ON storage.objects
FOR SELECT
USING (
  auth.uid()::text = (storage.foldername)[1]
);
```

#### Cost Optimization
- ~3MB per video attempt
- ~61MB per student/month (raw)
- 95% storage saving through landmark-only storage
- Fits free tier for development

### 17.3 Scaling Considerations

#### Current Scale (Free Tier)
- 500MB database
- 1GB file storage
- 2GB bandwidth
- 50MB database backups
- 50,000 edge function calls

#### Future Scaling Options
1. **Storage Expansion**
   - AWS S3 integration
   - CloudFront CDN
   - Multi-region deployment

2. **Performance Optimization**
   - Edge function optimization
   - Caching layers
   - Load balancing

3. **Monitoring**
   - Storage usage tracking
   - Performance metrics
   - Error reporting
   - Usage patterns

## 18. **Future Enhancements**
- Mobile app development
- Offline mode support
- Integration with learning management systems
- Advanced analytics and reporting
- AI-powered personalized feedback
- Group practice sessions
- Gamification elements