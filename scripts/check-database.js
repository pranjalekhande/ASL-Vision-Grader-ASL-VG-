#!/usr/bin/env node

/**
 * Check what's actually in the Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

async function checkDatabase() {
  console.log('🔍 Checking Supabase database contents...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }
  
  const supabase = createClient(url, key);
  
  const { data: signs, error } = await supabase
    .from('signs')
    .select('*');
  
  if (error) {
    console.error('❌ Database error:', error.message);
    return;
  }
  
  console.log(`\n📊 Found ${signs.length} signs in database:`);
  
  signs.forEach((sign, index) => {
    console.log(`\n${index + 1}. ${sign.gloss}:`);
    console.log(`   ID: ${sign.id}`);
    console.log(`   Created: ${sign.created_at}`);
    console.log(`   Updated: ${sign.updated_at}`);
    
    if (sign.exemplar_landmarks) {
      const frames = sign.exemplar_landmarks.frames?.length || 0;
      const duration = sign.exemplar_landmarks.duration || 0;
      console.log(`   Exemplar: ${frames} frames, ${duration}ms duration`);
      
      if (sign.exemplar_landmarks.frames?.[0]) {
        const firstFrame = sign.exemplar_landmarks.frames[0];
        const landmarkCount = firstFrame.landmarks?.[0]?.length || 0;
        console.log(`   Landmarks: ${landmarkCount} points per frame`);
        
        if (firstFrame.landmarks?.[0]?.[0]) {
          const wrist = firstFrame.landmarks[0][0];
          console.log(`   Wrist pos: (${wrist.x?.toFixed(3)}, ${wrist.y?.toFixed(3)}, ${wrist.z?.toFixed(3)})`);
        }
      }
    } else {
      console.log('   Exemplar: No landmark data');
    }
    
    if (sign.metadata) {
      console.log(`   Metadata source: ${sign.metadata.source || 'unknown'}`);
      console.log(`   Generated: ${sign.metadata.generated_at || 'unknown'}`);
      if (sign.metadata.frame_count) {
        console.log(`   Frame count: ${sign.metadata.frame_count}`);
      }
      if (sign.metadata.quality_score) {
        console.log(`   Quality: ${sign.metadata.quality_score}`);
      }
    } else {
      console.log('   Metadata: None');
    }
  });
  
  // Check for recent updates
  const recentSigns = signs.filter(s => {
    const updated = new Date(s.updated_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return updated > fiveMinutesAgo;
  });
  
  console.log(`\n🕒 ${recentSigns.length} signs updated in last 5 minutes:`);
  recentSigns.forEach(s => {
    console.log(`   ${s.gloss}: ${s.updated_at}`);
  });
}

async function main() {
  try {
    await checkDatabase();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


