#!/usr/bin/env node

/**
 * Create test exemplars with minimal data
 * Uses small sample videos or creates realistic test data
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Minimal test set - just 3 signs to start
const TEST_SIGNS = ['HELLO', 'YES', 'NO'];

/**
 * Create realistic test landmarks that look different from current synthetic data
 */
function createTestLandmarks(signName) {
  console.log(`🎨 Creating test landmarks for ${signName}...`);
  
  const frameCount = Math.floor(30 + Math.random() * 40); // 30-70 frames
  const duration = 2000 + Math.random() * 1000; // 2-3 seconds
  
  const landmarks = {
    startTime: 0,
    endTime: duration,
    duration: duration,
    frames: []
  };
  
  // Different movement patterns for each sign
  const movements = {
    'HELLO': { type: 'wave', amplitude: 0.15, frequency: 2 },
    'YES': { type: 'nod', amplitude: 0.08, frequency: 3 },
    'NO': { type: 'shake', amplitude: 0.12, frequency: 2.5 }
  };
  
  const movement = movements[signName] || movements['HELLO'];
  
  for (let i = 0; i < frameCount; i++) {
    const progress = i / frameCount;
    const timestamp = Math.floor(progress * duration);
    
    // Generate 21 realistic hand landmarks
    const landmarkPoints = [];
    
    for (let j = 0; j < 21; j++) {
      let x, y, z;
      
      // Base hand positions (realistic MediaPipe topology)
      if (j === 0) { // Wrist
        x = 0.5;
        y = 0.4;
        z = 0.0;
      } else if (j <= 4) { // Thumb
        x = 0.42 + (j - 1) * 0.02;
        y = 0.38 - (j - 1) * 0.02;
        z = 0.01;
      } else if (j <= 8) { // Index finger
        x = 0.48 + (j - 5) * 0.01;
        y = 0.32 - (j - 5) * 0.04;
        z = 0.0;
      } else if (j <= 12) { // Middle finger
        x = 0.50 + (j - 9) * 0.01;
        y = 0.30 - (j - 9) * 0.04;
        z = -0.01;
      } else if (j <= 16) { // Ring finger
        x = 0.52 + (j - 13) * 0.01;
        y = 0.32 - (j - 13) * 0.04;
        z = -0.01;
      } else { // Pinky
        x = 0.54 + (j - 17) * 0.01;
        y = 0.34 - (j - 17) * 0.03;
        z = 0.0;
      }
      
      // Apply sign-specific movements
      switch (movement.type) {
        case 'wave':
          x += movement.amplitude * Math.sin(movement.frequency * Math.PI * progress);
          y += movement.amplitude * 0.3 * Math.sin(movement.frequency * Math.PI * progress);
          break;
        case 'nod':
          y += movement.amplitude * Math.sin(movement.frequency * Math.PI * progress);
          break;
        case 'shake':
          x += movement.amplitude * Math.sin(movement.frequency * Math.PI * progress);
          break;
      }
      
      // Add slight natural variation
      x += (Math.random() - 0.5) * 0.005;
      y += (Math.random() - 0.5) * 0.005;
      z += (Math.random() - 0.5) * 0.002;
      
      landmarkPoints.push([x, y, z]);
    }
    
    landmarks.frames.push({
      timestamp,
      landmarks: [landmarkPoints],
      handedness: ['Right'],
      confidence: 0.92 + Math.random() * 0.06 // 0.92-0.98
    });
  }
  
  console.log(`  ✅ Created ${frameCount} frames for ${signName}`);
  return landmarks;
}

/**
 * Update a single sign in the database
 */
async function updateSign(signName) {
  try {
    const landmarks = createTestLandmarks(signName);
    
    const { data, error } = await supabase
      .from('signs')
      .update({
        exemplar_landmarks: landmarks,
        updated_at: new Date().toISOString()
      })
      .eq('gloss', signName)
      .select();
    
    if (error) {
      console.error(`❌ Failed to update ${signName}:`, error.message);
      return false;
    }
    
    console.log(`✅ Updated ${signName} with ${landmarks.frames.length} frames`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error updating ${signName}:`, error.message);
    return false;
  }
}

/**
 * Check current database state
 */
async function checkDatabase() {
  console.log('🔍 Checking current database state...\n');
  
  const { data, error } = await supabase
    .from('signs')
    .select('gloss, updated_at')
    .in('gloss', TEST_SIGNS)
    .order('gloss');
  
  if (error) {
    console.error('❌ Database check failed:', error.message);
    return;
  }
  
  data.forEach(sign => {
    const updatedTime = new Date(sign.updated_at).toLocaleString();
    console.log(`📊 ${sign.gloss}: ${sign.exemplar_source || 'unknown'} (${updatedTime})`);
  });
  
  console.log('');
}

/**
 * Main execution
 */
async function main() {
  console.log('🧪 Creating Test Exemplars (Minimal Set)');
  console.log('=' .repeat(50));
  
  await checkDatabase();
  
  console.log('🔄 Updating test signs with realistic exemplars...\n');
  
  let successCount = 0;
  
  for (const signName of TEST_SIGNS) {
    if (await updateSign(signName)) {
      successCount++;
    }
  }
  
  console.log('\n📊 Results:');
  console.log(`✅ Successfully updated: ${successCount}/${TEST_SIGNS.length} signs`);
  console.log(`🎯 Test signs: ${TEST_SIGNS.join(', ')}`);
  
  if (successCount === TEST_SIGNS.length) {
    console.log('\n🎉 Test exemplars created successfully!');
    console.log('💡 These exemplars have more realistic movement patterns');
    console.log('🔍 Try recording these signs to see improved scoring');
  } else {
    console.log('\n⚠️ Some updates failed. Check the errors above.');
  }
  
  console.log('\n🚀 Next steps:');
  console.log('   1. Test the app with HELLO, YES, or NO signs');
  console.log('   2. Check if the heatmap and scoring look more realistic');
  console.log('   3. Expand to more signs if satisfied with results');
}

main().catch(console.error);
