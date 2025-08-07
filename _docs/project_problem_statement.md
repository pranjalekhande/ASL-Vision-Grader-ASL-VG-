# Project 2 | ASL Vision Grader (ASL-VG)

## 2.1 Product Goal

A web widget that evaluates 5-second ASL word videos and produces:
- A score (0-100) for handshape, location, and movement accuracy
- A frame-overlay heat-map showing where the student deviated

*No proprietary footage is assumed; teams rely on open datasets such as ASLLVD and WLASL. (Boston University, Kaggle)*

## 2.2 End-User Stories

| Role | Story | Acceptance Criteria |
|------|-------|-------------------|
| Student | "After recording my sign, I instantly see green/red overlays on my hands showing correctness." | • Feedback appears ≤ 3s after upload. |
| Teacher | "I see a dashboard with each attempt thumbnail and score trend over time." | • Hovering plays the clip plus overlay. |

## 2.3 Reference Stack & Components

| Layer | Service | Notes |
|-------|---------|-------|
| Client-side pose | MediaPipe Holistic/HandLandmarker via WASM | 543 landmarks per frame, runs ~30 FPS on laptop. (Google AI for Developers, Google Research) |
| Sequence Matcher | Node-Python child process (DTW algorithm) | Compares time-aligned landmark vectors to exemplar templates. |
| Exemplar Store | Postgres JSONB | landmarks: float4[] per frame; synthetic signs seeded from open datasets. |
| Feedback Renderer | HTML5 Canvas overlay | Green if Δ < ε, red otherwise; uses easing for smooth heat-map. |
| LLM Narrative (optional) | GPT-4o | Converts numeric deltas into human-readable feedback ("Hand too low at 0:01"). |

## 2.4 Sequence Diagram (textual)

1. Record – MediaRecorder captures 720p / 30 FPS MP4 (max 7s).
2. POST /api/attempts/upload.
3. Server extracts every 3rd frame → runs MediaPipe (optional server-side if GPU).
4. Output landmark list → Dynamic Time Warping (DTW) vs. exemplar.
5. Calculate per-dimension error (x, y, z) → aggregate into handshape/location/movement scores.
6. Persist attempt row; return JSON with scores + normalized heat-map arrays.
7. Front-end overlays colored outlines over the video frames on replay.

## 2.5 Minimal Schema

```sql
CREATE TABLE signs (
  id UUID PRIMARY KEY,
  gloss TEXT,                -- e.g. 'APPLE'
  exemplar_landmarks JSONB   -- [[543 floats] x N frames]
);

CREATE TABLE attempts (
  id UUID PRIMARY KEY,
  student_id UUID REFERENCES students,
  sign_id UUID REFERENCES signs,
  score_shape REAL,
  score_location REAL,
  score_movement REAL,
  heatmap JSONB,             -- optional per-frame deltas
  video_url TEXT,
  created_at TIMESTAMPTZ
);
```

## 2.6 Datasets & Licensing

| Dataset | #Words | License | Boot-camp Use |
|---------|--------|---------|---------------|
| ASLLVD (BU) | 3,300 signs | CC BY-NC-SA | Use isolated citation-form clips to seed exemplars. |
| WLASL | 2,000 words | Research only (custom) | Use train split only; link to Kaggle mirror. |

*Teams should include attribution and restrict commercial use in the README.*

## 2.7 Synthetic Data Strategy

Because both open datasets may have usage restrictions, provide:
- `/data/exemplars/*.json` – extracted landmark vectors for ten common signs ("HELLO", "THANK-YOU", …).
- Generated error samples – script perturbs exemplar landmarks (± 3%) to create "student" attempts for demo dashboards.

## 2.8 Stretch Goals

1. **Real-time Gesture Hints**
   - WebRTC peer connection streams landmarks continuously
   - Bot flashes corrective arrows mid-sign

2. **Multi-sign Phrase Scoring**
   - Segment-first with BLSTM
   - Then apply the DTW per sign

3. **Accessibility Overlay**
   - Add caption "Too high 🡇" as text for HOH learners

## 3. Boot-Camp Playbook

| Phase | Hours | Deliverables | Guard-rails |
|-------|-------|--------------|-------------|
| Kick-off | 0-4 | Forked repo, DB migration, dummy data seed script. | Use .env.example with OPENAI_API_KEY and ELEVENLABS_API_KEY. |
| Prototype Pipeline | 5-40 | Working STT→LLM→TTS loop or landmark extractor→scorer. | Use mocked endpoints first to iron out front-end. |
| Integration & Latency | 41-65 | WebSocket bi-directional stream; basic Postgres writes. | Measure p95 latency with synthetic mic/video input. |
| Polish | 66-90 | Responsive UI, teacher dashboard, readme, attributions. | Lighthouse score ≥ 85. |
| Demo Day | 90-100 | 5-min walkthrough video + URL + repo. | Remove all secrets; keep free-tier usage. |