#!/usr/bin/env node

/**
 * Force update one sign to test database connection
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

async function forceUpdate() {
  console.log('🔧 Force updating HELLO sign for testing...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  console.log('🔑 Available keys:');
  console.log(`   VITE_SUPABASE_URL: ${url ? 'Set' : 'Missing'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? 'Set' : 'Missing'}`);
  console.log(`   VITE_SUPABASE_ANON_KEY: ${anonKey ? 'Set' : 'Missing'}`);
  
  // Try service key first
  let supabase;
  if (serviceKey) {
    console.log('🔐 Using service role key (bypasses RLS)');
    supabase = createClient(url, serviceKey);
  } else if (anonKey) {
    console.log('🔑 Using anon key (subject to RLS)');
    supabase = createClient(url, anonKey);
  } else {
    throw new Error('No Supabase key available');
  }
  
  // Test a simple update with new timestamp
  const testData = {
    exemplar_landmarks: {
      startTime: 0,
      endTime: 1000,
      duration: 1000,
      frames: [
        {
          timestamp: 0,
          landmarks: [[
            {x: 0.5, y: 0.3, z: 0.0, confidence: 0.95}, // wrist - different position
            {x: 0.42, y: 0.28, z: 0.01, confidence: 0.93}, // thumb
            {x: 0.44, y: 0.26, z: 0.02, confidence: 0.92},
            {x: 0.46, y: 0.24, z: 0.02, confidence: 0.91},
            {x: 0.48, y: 0.22, z: 0.01, confidence: 0.90},
            // Add remaining 16 landmarks...
            {x: 0.47, y: 0.18, z: 0.0, confidence: 0.89},
            {x: 0.48, y: 0.14, z: 0.0, confidence: 0.88},
            {x: 0.49, y: 0.10, z: 0.0, confidence: 0.87},
            {x: 0.50, y: 0.06, z: 0.0, confidence: 0.86},
            {x: 0.50, y: 0.17, z: 0.0, confidence: 0.89},
            {x: 0.50, y: 0.13, z: 0.0, confidence: 0.88},
            {x: 0.50, y: 0.09, z: 0.0, confidence: 0.87},
            {x: 0.50, y: 0.05, z: 0.0, confidence: 0.86},
            {x: 0.53, y: 0.19, z: 0.0, confidence: 0.89},
            {x: 0.53, y: 0.15, z: 0.0, confidence: 0.88},
            {x: 0.53, y: 0.11, z: 0.0, confidence: 0.87},
            {x: 0.53, y: 0.07, z: 0.0, confidence: 0.86},
            {x: 0.56, y: 0.22, z: 0.0, confidence: 0.89},
            {x: 0.56, y: 0.18, z: 0.0, confidence: 0.88},
            {x: 0.56, y: 0.14, z: 0.0, confidence: 0.87},
            {x: 0.56, y: 0.10, z: 0.0, confidence: 0.86}
          ]],
          handedness: ['Right']
        }
      ]
    },
    metadata: {
      source: 'force_update_test',
      updated_at: new Date().toISOString(),
      test: true
    }
  };
  
  console.log('\n📝 Attempting update...');
  
  const { data, error } = await supabase
    .from('signs')
    .update(testData)
    .eq('gloss', 'HELLO')
    .select();
  
  if (error) {
    console.error('❌ Update failed:', error);
    
    // Try to diagnose the issue
    console.log('\n🔍 Diagnosing issue...');
    
    // Check if we can read the table
    const { data: readTest, error: readError } = await supabase
      .from('signs')
      .select('gloss, updated_at')
      .eq('gloss', 'HELLO');
    
    if (readError) {
      console.error('❌ Cannot read signs table:', readError);
    } else {
      console.log('✅ Can read signs table:', readTest);
    }
    
  } else {
    console.log('✅ Update successful!');
    console.log('📊 Updated data:', data);
  }
}

async function main() {
  try {
    await forceUpdate();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  main();
}


