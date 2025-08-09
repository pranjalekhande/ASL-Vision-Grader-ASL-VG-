#!/usr/bin/env node

/**
 * Check exact gloss values in database to debug UPDATE matching
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

async function checkGlossValues() {
  console.log('🔍 Checking exact gloss values in database...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  
  const supabase = createClient(url, key);
  
  const { data: signs, error } = await supabase
    .from('signs')
    .select('id, gloss, created_at')
    .order('created_at');
  
  if (error) {
    console.error('❌ Error reading signs:', error.message);
    return;
  }
  
  console.log(`\n📊 Found ${signs.length} signs with these exact gloss values:`);
  
  signs.forEach((sign, index) => {
    const glossBytes = Buffer.from(sign.gloss, 'utf8');
    console.log(`${index + 1}. "${sign.gloss}" (length: ${sign.gloss.length}, bytes: [${Array.from(glossBytes).join(', ')}])`);
    console.log(`   ID: ${sign.id}`);
    console.log(`   Created: ${sign.created_at}`);
  });
  
  // Test exact matching
  console.log('\n🧪 Testing exact matches:');
  
  const testGlosses = ['HELLO', 'THANK-YOU', 'PLEASE'];
  
  for (const testGloss of testGlosses) {
    const { data: matches, error: matchError } = await supabase
      .from('signs')
      .select('id, gloss')
      .eq('gloss', testGloss);
    
    if (matchError) {
      console.log(`   ❌ Error testing "${testGloss}": ${matchError.message}`);
    } else {
      console.log(`   "${testGloss}": ${matches.length} matches`);
      if (matches.length > 0) {
        console.log(`      Matched: "${matches[0].gloss}" (ID: ${matches[0].id})`);
      }
    }
  }
}

async function testDirectUpdate() {
  console.log('\n🔧 Testing direct update with first available sign...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  
  const supabase = createClient(url, key);
  
  // Get the first sign
  const { data: firstSign, error: selectError } = await supabase
    .from('signs')
    .select('id, gloss')
    .limit(1)
    .single();
  
  if (selectError) {
    console.error('❌ Error getting first sign:', selectError.message);
    return;
  }
  
  console.log(`📝 Attempting to update sign: "${firstSign.gloss}" (ID: ${firstSign.id})`);
  
  // Try update by ID instead of gloss
  const updateData = {
    metadata: {
      test_update: new Date().toISOString(),
      test_by_id: true
    }
  };
  
  const { data: updateResult, error: updateError } = await supabase
    .from('signs')
    .update(updateData)
    .eq('id', firstSign.id)
    .select();
  
  if (updateError) {
    console.log(`❌ Update by ID failed: ${updateError.message}`);
    console.log(`   Code: ${updateError.code}`);
    console.log(`   Details: ${updateError.details}`);
  } else {
    console.log(`✅ Update by ID successful!`);
    console.log(`   Rows affected: ${updateResult?.length || 0}`);
    if (updateResult && updateResult.length > 0) {
      console.log(`   Updated data:`, updateResult[0]);
    }
  }
}

async function main() {
  try {
    await checkGlossValues();
    await testDirectUpdate();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


