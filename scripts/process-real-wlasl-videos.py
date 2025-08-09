#!/usr/bin/env python3
"""
Real WLASL Video Processing Script
Downloads actual WLASL videos and extracts landmarks using MediaPipe
"""

import os
import sys
import json
import requests
import subprocess
import cv2
import mediapipe as mp
import numpy as np
from pathlib import Path
import time
from datetime import datetime
import hashlib

# Setup MediaPipe
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

class WLASLProcessor:
    def __init__(self, supabase_url=None, supabase_key=None):
        self.hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        
        # Target signs we want to process
        self.target_signs = [
            'hello', 'thank you', 'please', 'sorry', 'yes',
            'no', 'help', 'name', 'good', 'water'
        ]
        
        # Create directories
        self.data_dir = Path('data')
        self.video_dir = self.data_dir / 'videos'
        self.landmarks_dir = self.data_dir / 'landmarks'
        
        for dir_path in [self.data_dir, self.video_dir, self.landmarks_dir]:
            dir_path.mkdir(exist_ok=True)
    
    def download_wlasl_metadata(self):
        """Download WLASL dataset metadata from GitHub"""
        print("📥 Downloading WLASL metadata from GitHub...")
        
        # Try multiple possible URLs for WLASL data
        possible_urls = [
            "https://raw.githubusercontent.com/dxli94/WLASL/master/start_kit/WLASL_v0.3.json",
            "https://raw.githubusercontent.com/dxli94/WLASL/main/start_kit/WLASL_v0.3.json", 
            "https://raw.githubusercontent.com/dxli94/WLASL/master/WLASL_v0.3.json",
            "https://raw.githubusercontent.com/dxli94/WLASL/main/WLASL_v0.3.json"
        ]
        
        wlasl_data = None
        for metadata_url in possible_urls:
            try:
                print(f"  🔍 Trying: {metadata_url}")
                response = requests.get(metadata_url, timeout=30)
                response.raise_for_status()
                
                wlasl_data = response.json()
                metadata_file = self.data_dir / 'WLASL_v0.3.json'
                with open(metadata_file, 'w') as f:
                    json.dump(wlasl_data, f, indent=2)
                
                print(f"✅ Downloaded WLASL metadata: {len(wlasl_data)} signs")
                return wlasl_data
                
            except Exception as e:
                print(f"  ❌ Failed: {e}")
                continue
        
        print("❌ All WLASL metadata URLs failed. Using fallback synthetic data...")
        return self.create_fallback_data()
    
    def create_fallback_data(self):
        """Create fallback data when WLASL is unavailable"""
        print("🔄 Creating fallback WLASL-style data structure...")
        
        # For demonstration, we'll create mock video entries that would
        # normally come from the real WLASL dataset
        fallback_data = []
        
        for sign in self.target_signs:
            sign_data = {
                "gloss": sign.upper(),
                "instances": [
                    {
                        "video_id": f"demo_{sign}",
                        "url": f"https://example.com/demo_{sign}.mp4",  # Mock URL
                        "start_time": 0.0,
                        "end_time": 3.0,
                        "bbox": {"x": 0.2, "y": 0.2, "w": 0.6, "h": 0.6},
                        "fps": 30,
                        "signer_id": 1
                    }
                ]
            }
            fallback_data.append(sign_data)
        
        print(f"✅ Created fallback data for {len(fallback_data)} signs")
        return fallback_data
    
    def find_target_videos(self, wlasl_data):
        """Find video URLs for our target signs"""
        print("🎯 Finding videos for target signs...")
        
        target_videos = {}
        
        for sign_data in wlasl_data:
            gloss = sign_data.get('gloss', '').lower()
            
            if gloss in self.target_signs:
                instances = sign_data.get('instances', [])
                if instances:
                    # Take the first instance for now
                    instance = instances[0]
                    video_url = f"https://www.youtube.com/watch?v={instance['video_id']}"
                    
                    target_videos[gloss] = {
                        'url': video_url,
                        'start_time': instance.get('start_time', 0),
                        'end_time': instance.get('end_time', 5),
                        'video_id': instance['video_id'],
                        'bbox': instance.get('bbox', {}),
                        'fps': instance.get('fps', 30)
                    }
                    
                    print(f"  ✅ Found {gloss.upper()}: {video_url}")
        
        print(f"📊 Found {len(target_videos)} target signs")
        return target_videos
    
    def download_video(self, video_info, sign_name):
        """Download video using yt-dlp"""
        print(f"🎥 Downloading video for {sign_name.upper()}...")
        
        video_path = self.video_dir / f"{sign_name}.mp4"
        
        try:
            # Use yt-dlp to download video segment
            cmd = [
                'yt-dlp',
                '-f', 'best[height<=480]',  # 480p max for processing speed
                '--external-downloader', 'ffmpeg',
                '--external-downloader-args', 
                f'ffmpeg:-ss {video_info["start_time"]} -t {video_info["end_time"] - video_info["start_time"]}',
                '-o', str(video_path),
                video_info['url']
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0 and video_path.exists():
                print(f"  ✅ Downloaded {sign_name}: {video_path}")
                return str(video_path)
            else:
                print(f"  ❌ Failed to download {sign_name}: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            print(f"  ⏱️ Download timeout for {sign_name}")
            return None
        except Exception as e:
            print(f"  ❌ Download error for {sign_name}: {e}")
            return None
    
    def extract_landmarks(self, video_path, sign_name):
        """Extract hand landmarks from video using MediaPipe"""
        print(f"🔍 Extracting landmarks for {sign_name.upper()}...")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"  ❌ Cannot open video: {video_path}")
            return None
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps
        
        print(f"  📹 Video: {frame_count} frames, {fps:.1f} FPS, {duration:.1f}s")
        
        landmarks_data = {
            "startTime": 0,
            "endTime": int(duration * 1000),
            "duration": int(duration * 1000),
            "frames": []
        }
        
        frame_idx = 0
        processed_frames = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process every 3rd frame (30fps -> 10fps)
            if frame_idx % 3 == 0:
                timestamp = int((frame_idx / fps) * 1000)
                
                # Convert BGR to RGB for MediaPipe
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.hands.process(rgb_frame)
                
                if results.multi_hand_landmarks:
                    # Take the first hand
                    hand_landmarks = results.multi_hand_landmarks[0]
                    handedness = results.multi_handedness[0].classification[0].label
                    
                    # Extract landmark coordinates
                    landmarks = []
                    for landmark in hand_landmarks.landmark:
                        landmarks.append([landmark.x, landmark.y, landmark.z])
                    
                    frame_data = {
                        "timestamp": timestamp,
                        "landmarks": [landmarks],  # Wrap in array for consistency
                        "handedness": [handedness],
                        "confidence": results.multi_handedness[0].classification[0].score
                    }
                    
                    landmarks_data["frames"].append(frame_data)
                    processed_frames += 1
            
            frame_idx += 1
        
        cap.release()
        
        if processed_frames > 0:
            print(f"  ✅ Extracted {processed_frames} frames with landmarks")
            
            # Save landmarks to file
            landmarks_file = self.landmarks_dir / f"{sign_name}.json"
            with open(landmarks_file, 'w') as f:
                json.dump(landmarks_data, f, indent=2)
            
            return landmarks_data
        else:
            print(f"  ❌ No landmarks detected in {sign_name}")
            return None
    
    def update_supabase(self, sign_name, landmarks_data):
        """Update Supabase with real landmark data"""
        if not self.supabase_url or not self.supabase_key:
            print("  ⚠️ No Supabase credentials, skipping database update")
            return False
        
        print(f"💾 Updating database for {sign_name.upper()}...")
        
        try:
            import subprocess
            import tempfile
            
            # Create a temporary Node.js script to update Supabase
            update_script = f"""
const {{ createClient }} = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient('{self.supabase_url}', '{self.supabase_key}');

async function updateSign() {{
  const landmarksData = {json.dumps(landmarks_data)};
  
  const {{ data, error }} = await supabase
    .from('signs')
    .update({{
      exemplar_landmarks: landmarksData,
      exemplar_source: 'wlasl_real',
      exemplar_quality: 0.95,
      updated_at: new Date().toISOString()
    }})
    .eq('gloss', '{sign_name.upper()}')
    .select();
  
  if (error) {{
    console.error('❌ Update failed:', error);
    process.exit(1);
  }} else {{
    console.log('✅ Updated {sign_name.upper()} in database');
    process.exit(0);
  }}
}}

updateSign();
"""
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                f.write(update_script)
                temp_script = f.name
            
            result = subprocess.run(['node', temp_script], capture_output=True, text=True)
            os.unlink(temp_script)
            
            if result.returncode == 0:
                print(f"  ✅ Database updated for {sign_name}")
                return True
            else:
                print(f"  ❌ Database update failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"  ❌ Database update error: {e}")
            return False
    
    def process_all_signs(self):
        """Main processing pipeline"""
        print("🚀 Starting real WLASL video processing...")
        
        # Check for required tools
        try:
            subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ yt-dlp not found. Install with: pip install yt-dlp")
            return False
        
        # Download metadata
        wlasl_data = self.download_wlasl_metadata()
        if not wlasl_data:
            return False
        
        # Find target videos
        target_videos = self.find_target_videos(wlasl_data)
        if not target_videos:
            print("❌ No target videos found")
            return False
        
        success_count = 0
        
        # Process each sign
        for sign_name, video_info in target_videos.items():
            print(f"\n🔄 Processing {sign_name.upper()}...")
            
            # Download video
            video_path = self.download_video(video_info, sign_name)
            if not video_path:
                continue
            
            # Extract landmarks
            landmarks_data = self.extract_landmarks(video_path, sign_name)
            if not landmarks_data:
                continue
            
            # Update database
            if self.update_supabase(sign_name, landmarks_data):
                success_count += 1
            
            # Clean up video file to save space
            try:
                os.remove(video_path)
                print(f"  🗑️ Cleaned up video file")
            except:
                pass
        
        print(f"\n🎉 Processing complete!")
        print(f"📊 Successfully processed {success_count}/{len(target_videos)} signs")
        
        return success_count > 0

def main():
    # Get Supabase credentials from environment
    supabase_url = os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("⚠️ Warning: No Supabase credentials found")
        print("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables")
        print("Proceeding with landmark extraction only...")
    
    processor = WLASLProcessor(supabase_url, supabase_key)
    success = processor.process_all_signs()
    
    if success:
        print("\n✅ Real WLASL data processing completed successfully!")
        print("The database now contains authentic ASL landmark data.")
    else:
        print("\n❌ Processing failed. Check errors above.")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())