# Real Exemplar Data Implementation Plan

## Overview
Replace synthetic exemplar data with real ASL landmarks extracted from ASLLVD and WLASL datasets to provide meaningful scoring.

## 📊 Current Status
- ❌ **Using synthetic/mathematical landmark data**
- ❌ **Scores are not meaningful** (comparing real signs to fake patterns)
- ❌ **Visual feedback not accurate** (reference hands don't match real ASL)

## 🎯 Goal
- ✅ **Extract landmarks from real ASL videos**
- ✅ **Store authentic exemplars in database**
- ✅ **Provide meaningful scoring against real ASL patterns**

## 🛠 Implementation Approach

### Phase 1: Dataset Access & Setup
**Time Estimate: 1-2 days**

#### WLASL Dataset (Primary)
- **Source**: https://github.com/dxli94/WLASL
- **Content**: 2,000+ ASL words from YouTube videos
- **License**: Academic/research use only
- **Format**: JSON metadata + video URLs

**Steps:**
1. Clone WLASL repository
2. Install dependencies (`yt-dlp`, `mediapipe`)
3. Download video metadata for target signs
4. Set up video processing pipeline

#### ASLLVD Dataset (Secondary)
- **Source**: Boston University ASL-LRP
- **Content**: 3,300+ signs from native signers
- **License**: Research/educational use
- **Format**: Direct video files + annotations

### Phase 2: Video Processing Pipeline
**Time Estimate: 2-3 days**

#### Components Needed:
1. **Video Downloader**
   - Use `yt-dlp` for YouTube videos
   - Handle rate limiting and errors
   - Download in appropriate resolution (480p)

2. **Landmark Extractor**
   - MediaPipe Python integration
   - Extract 21 hand landmarks per frame
   - Process every 3rd frame (30fps → 10fps)
   - Output JSON format matching our schema

3. **Quality Validator**
   - Check landmark confidence scores
   - Validate complete hand visibility
   - Filter out poor quality segments

4. **Data Normalizer**
   - Standardize coordinate systems
   - Handle different video resolutions
   - Align timing and frame rates

### Phase 3: Target Signs Processing
**Time Estimate: 1-2 days**

#### Priority Signs (10 total):
1. **HELLO** - Wave gesture, common greeting
2. **THANK-YOU** - Chin to forward motion
3. **PLEASE** - Circular motion on chest
4. **SORRY** - Circular motion with fist
5. **YES** - Fist nod motion
6. **NO** - Two-finger side-to-side
7. **HELP** - Lifting motion
8. **NAME** - Two-finger tap
9. **GOOD** - Forward motion with flat hand
10. **WATER** - W-shape tap motion

#### Processing Per Sign:
- Download 3-5 video instances per sign
- Extract landmarks from each video
- Quality check and validation
- Select best exemplar for database
- Store multiple variations if available

### Phase 4: Database Integration
**Time Estimate: 1 day**

#### Schema Updates:
```sql
-- Add real exemplar metadata
ALTER TABLE signs ADD COLUMN IF NOT EXISTS exemplar_source TEXT;
ALTER TABLE signs ADD COLUMN IF NOT EXISTS exemplar_quality NUMERIC;
ALTER TABLE signs ADD COLUMN IF NOT EXISTS signer_id TEXT;
ALTER TABLE signs ADD COLUMN IF NOT EXISTS variation_count INTEGER;
```

#### Data Structure:
```json
{
  "exemplar_landmarks": {
    "startTime": 0,
    "endTime": 2500,
    "duration": 2500,
    "frames": [
      {
        "timestamp": 0,
        "landmarks": [[/* 21 landmarks */]],
        "handedness": ["Right"],
        "confidence": 0.94
      }
    ]
  },
  "metadata": {
    "source": "wlasl",
    "video_id": "abc123",
    "signer_id": "signer_001",
    "quality_score": 0.92,
    "variation_id": 0,
    "processed_at": "2024-01-08T..."
  }
}
```

### Phase 5: Quality Assurance
**Time Estimate: 1 day**

#### Validation Steps:
1. **Visual Inspection**
   - Compare extracted landmarks to original videos
   - Verify hand shapes match expected ASL forms
   - Check movement patterns are natural

2. **Scoring Validation**
   - Test with known good/bad signing examples
   - Verify scores are more meaningful than synthetic
   - Check heatmap accuracy

3. **Performance Testing**
   - Measure processing time for real data
   - Ensure 3-second feedback target is met
   - Optimize if needed

## 🔧 Technical Implementation

### Required Dependencies:
```bash
# Python packages
pip install mediapipe opencv-python yt-dlp

# Node.js packages (already installed)
npm install @supabase/supabase-js dotenv
```

### Scripts Created:
1. **`scripts/download-wlasl-data.js`** - Main processing script
2. **`scripts/extract_landmarks.py`** - MediaPipe integration
3. **Package scripts**: `npm run download:wlasl`

### Directory Structure:
```
data/
├── wlasl/
│   ├── WLASL_v0.3.json      # Metadata
│   └── videos/              # Downloaded videos
├── landmarks/               # Extracted landmarks
└── processed/               # Final processed data
```

## 🚀 Execution Plan

### Step 1: Run Initial Processing
```bash
# Install Python dependencies
pip install mediapipe opencv-python yt-dlp

# Run WLASL data processing
npm run download:wlasl
```

### Step 2: Validate Results
- Check console output for processing status
- Verify database updates in Supabase
- Test app with new exemplars

### Step 3: Iterative Improvement
- Process additional signs if needed
- Improve quality filtering
- Add multiple variations per sign

## 📈 Expected Outcomes

### Before (Synthetic):
- Scores: **Meaningless** (comparing to math functions)
- Visual: **Unrealistic** (smooth curves, wrong proportions)
- Learning: **Poor** (doesn't match real ASL)

### After (Real WLASL):
- Scores: **Meaningful** (comparing to authentic ASL)
- Visual: **Realistic** (actual signer hand shapes)
- Learning: **Effective** (matches real-world ASL patterns)

### Success Metrics:
- ✅ 10 signs with real exemplar data
- ✅ Landmark confidence > 90%
- ✅ Scoring reflects actual ASL accuracy
- ✅ Visual feedback matches real signing
- ✅ Processing time < 3 seconds

## 🔄 Next Steps

1. **Immediate**: Run `npm run download:wlasl` to start processing
2. **Short-term**: Validate quality and improve processing
3. **Medium-term**: Expand to full WLASL dataset (2000+ signs)
4. **Long-term**: Integrate ASLLVD for additional variations

## 📝 Notes

- **Licensing**: Ensure compliance with WLASL academic-use terms
- **Quality**: Prioritize high-confidence landmarks over quantity
- **Performance**: Balance accuracy with 3-second feedback target
- **Scalability**: Design for eventual expansion to full dataset

---

**This implementation will transform the ASL Vision Grader from a proof-of-concept to a meaningful learning tool with authentic ASL reference data.**
