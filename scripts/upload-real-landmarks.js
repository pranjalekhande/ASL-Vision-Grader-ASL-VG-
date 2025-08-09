#!/usr/bin/env node

/**
 * Upload real WLASL landmark data to Supabase
 * This script reads processed landmark JSON files and updates the database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

async function uploadRealLandmarks() {
  console.log('🚀 Uploading real WLASL landmark data to Supabase...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }
  
  const supabase = createClient(url, key);
  
  // Read landmarks directory
  const landmarksDir = path.join(__dirname, '../data/landmarks');
  
  if (!fs.existsSync(landmarksDir)) {
    console.error(`❌ Landmarks directory not found: ${landmarksDir}`);
    console.log('💡 Run the landmark extraction first:');
    console.log('   python scripts/process-real-wlasl-videos.py');
    return;
  }
  
  const landmarkFiles = fs.readdirSync(landmarksDir)
    .filter(file => file.endsWith('_landmarks.json'));
  
  if (landmarkFiles.length === 0) {
    console.error('❌ No landmark files found');
    return;
  }
  
  console.log(`📁 Found ${landmarkFiles.length} landmark files`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const filename of landmarkFiles) {
    try {
      const filePath = path.join(landmarksDir, filename);
      const landmarkData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Extract sign name from filename (e.g., "hello_1_landmarks.json" -> "HELLO")
      const signName = filename.split('_')[0].toUpperCase();
      
      console.log(`\n📝 Processing: ${signName} (${filename})`);
      console.log(`   📊 Frames: ${landmarkData.total_frames}`);
      console.log(`   🎯 Confidence: ${landmarkData.avg_confidence?.toFixed(3) || 'N/A'}`);
      
      // Prepare data for Supabase
      const exemplarData = {
        startTime: landmarkData.startTime || 0,
        endTime: landmarkData.endTime || landmarkData.duration || 0,
        duration: landmarkData.duration || 0,
        frames: landmarkData.frames || []
      };
      
      const metadata = {
        source: landmarkData.source || 'wlasl_processed',
        video_path: landmarkData.video_path || filename,
        total_frames: landmarkData.total_frames || 0,
        avg_confidence: landmarkData.avg_confidence || 0,
        processed_at: new Date().toISOString(),
        landmark_extraction: {
          method: 'mediapipe',
          quality_threshold: 0.7,
          frame_rate: '10fps',
          original_source: 'wlasl'
        }
      };
      
      // Update database
      const { data, error } = await supabase
        .from('signs')
        .update({
          exemplar_landmarks: exemplarData,
          metadata: metadata
        })
        .eq('gloss', signName);
      
      if (error) {
        console.error(`   ❌ Database error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Successfully updated database`);
        successCount++;
      }
      
    } catch (err) {
      console.error(`❌ Error processing ${filename}:`, err.message);
      errorCount++;
    }
  }
  
  console.log('\n🎉 Upload completed!');
  console.log(`📊 Results: ${successCount} successful, ${errorCount} failed`);
  
  if (successCount > 0) {
    console.log('\n💡 Next steps:');
    console.log('  1. Test the ASL Vision Grader with real exemplars');
    console.log('  2. Compare scoring accuracy with previous synthetic data');
    console.log('  3. Verify visual feedback improvements');
    console.log('\n🔗 Test at: http://localhost:5174/');
  }
}

async function verifyUpload() {
  console.log('🔍 Verifying uploaded landmark data...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  const supabase = createClient(url, key);
  
  const { data: signs, error } = await supabase
    .from('signs')
    .select('gloss, metadata')
    .not('exemplar_landmarks', 'is', null);
  
  if (error) {
    console.error('❌ Verification failed:', error.message);
    return;
  }
  
  console.log(`\n📊 Found ${signs.length} signs with exemplar data:`);
  
  signs.forEach(sign => {
    const source = sign.metadata?.source || 'unknown';
    const frames = sign.metadata?.total_frames || 'N/A';
    const confidence = sign.metadata?.avg_confidence?.toFixed(3) || 'N/A';
    
    console.log(`  ${sign.gloss}: ${source} (${frames} frames, confidence: ${confidence})`);
  });
  
  // Check for signs with WLASL data
  const wlaslSigns = signs.filter(s => 
    s.metadata?.source?.includes('wlasl') || 
    s.metadata?.landmark_extraction?.original_source === 'wlasl'
  );
  
  console.log(`\n✅ ${wlaslSigns.length} signs have WLASL-processed data`);
  
  if (wlaslSigns.length > 0) {
    console.log('🎯 Ready for testing with real exemplar data!');
  }
}

async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'upload':
        await uploadRealLandmarks();
        break;
      case 'verify':
        await verifyUpload();
        break;
      default:
        console.log('📋 ASL Vision Grader - Real Landmark Uploader');
        console.log('\nUsage:');
        console.log('  node scripts/upload-real-landmarks.js upload   # Upload processed landmarks');
        console.log('  node scripts/upload-real-landmarks.js verify   # Verify uploaded data');
        console.log('\n💡 First run landmark extraction:');
        console.log('  python scripts/process-real-wlasl-videos.py');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { uploadRealLandmarks, verifyUpload };


