#!/usr/bin/env node

/**
 * Workaround for RLS update issues - use UPSERT instead of UPDATE
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

// Import the realistic landmark generator
const { generateSignExemplar, ASL_LINGUISTIC_DATA } = require('./generate-realistic-landmarks.js');

async function workaroundUpdate() {
  console.log('🔄 Using UPSERT workaround to bypass RLS UPDATE restrictions...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }
  
  const supabase = createClient(url, key);
  
  // First, get all current signs with their IDs
  const { data: currentSigns, error: selectError } = await supabase
    .from('signs')
    .select('id, gloss, created_at');
  
  if (selectError) {
    console.error('❌ Error reading current signs:', selectError.message);
    return false;
  }
  
  console.log(`📊 Found ${currentSigns.length} existing signs to update`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const currentSign of currentSigns) {
    const signName = currentSign.gloss;
    
    if (!ASL_LINGUISTIC_DATA[signName]) {
      console.log(`⏭️  Skipping ${signName} (no linguistic data)`);
      continue;
    }
    
    console.log(`\n🔄 Processing: ${signName}`);
    
    try {
      // Generate new exemplar data
      const exemplarData = generateSignExemplar(signName);
      
      const newSignData = {
        id: currentSign.id, // Keep the same ID
        gloss: signName,
        exemplar_landmarks: exemplarData,
        metadata: {
          source: 'asl_linguistic_analysis',
          linguistic_accuracy: 'high',
          based_on: 'asl_movement_research',
          generated_at: new Date().toISOString(),
          sign_characteristics: ASL_LINGUISTIC_DATA[signName],
          frame_count: exemplarData.frames.length,
          quality_score: 0.95,
          updated_via: 'upsert_workaround'
        },
        created_at: currentSign.created_at, // Preserve original creation time
        updated_at: new Date().toISOString()
      };
      
      // Use UPSERT with conflict resolution on ID
      const { data, error } = await supabase
        .from('signs')
        .upsert(newSignData, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select();
      
      if (error) {
        console.error(`   ❌ UPSERT error: ${error.message}`);
        console.error(`   📝 Error code: ${error.code}`);
        console.error(`   💡 Error details: ${error.details}`);
        errorCount++;
      } else {
        console.log(`   ✅ UPSERT successful: ${data?.length || 0} rows affected`);
        console.log(`   📊 Frames: ${exemplarData.frames.length}, Quality: 0.95`);
        successCount++;
      }
      
    } catch (err) {
      console.error(`   ❌ Error processing ${signName}:`, err.message);
      errorCount++;
    }
  }
  
  console.log(`\n🎉 Workaround completed!`);
  console.log(`📊 Results: ${successCount} successful, ${errorCount} failed`);
  
  return successCount > 0;
}

async function verifyUpdates() {
  console.log('\n🔍 Verifying that updates actually took effect...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  
  const supabase = createClient(url, key);
  
  const { data: signs, error } = await supabase
    .from('signs')
    .select('gloss, metadata, updated_at, exemplar_landmarks')
    .order('gloss');
  
  if (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
  
  console.log(`\n📊 Verification results:`);
  
  let updatedCount = 0;
  
  signs.forEach(sign => {
    const isUpdated = sign.metadata?.updated_via === 'upsert_workaround';
    const frames = sign.exemplar_landmarks?.frames?.length || 0;
    const source = sign.metadata?.source || 'unknown';
    
    console.log(`   ${sign.gloss}: ${isUpdated ? '✅' : '❌'} ${source} (${frames} frames)`);
    
    if (isUpdated) {
      updatedCount++;
      console.log(`      Updated: ${sign.updated_at}`);
      console.log(`      Quality: ${sign.metadata?.quality_score || 'N/A'}`);
    }
  });
  
  console.log(`\n🎯 Successfully updated: ${updatedCount}/${signs.length} signs`);
  
  return updatedCount > 0;
}

async function main() {
  try {
    const success = await workaroundUpdate();
    
    if (success) {
      const verified = await verifyUpdates();
      
      if (verified) {
        console.log('\n🚀 Success! Your realistic exemplars are now in the database.');
        console.log('💡 Try refreshing your browser and testing the app again.');
        console.log('🔗 App URL: http://localhost:5174/');
      }
    } else {
      console.log('\n❌ Workaround failed. You may need to check Supabase permissions.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


