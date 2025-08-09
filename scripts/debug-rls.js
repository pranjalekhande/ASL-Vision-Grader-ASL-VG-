#!/usr/bin/env node

/**
 * Debug Supabase RLS policies and permissions
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

async function debugRLS() {
  console.log('🔍 Debugging Supabase RLS policies and permissions...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url) {
    throw new Error('Missing SUPABASE_URL');
  }
  
  console.log('\n🔑 Available Authentication:');
  console.log(`   Service Role Key: ${serviceKey ? '✅ Available' : '❌ Missing'}`);
  console.log(`   Anon Key: ${anonKey ? '✅ Available' : '❌ Missing'}`);
  
  // Test with both keys
  const clients = [];
  
  if (serviceKey) {
    clients.push({
      name: 'Service Role (bypasses RLS)',
      client: createClient(url, serviceKey),
      role: 'service_role'
    });
  }
  
  if (anonKey) {
    clients.push({
      name: 'Anonymous (subject to RLS)',
      client: createClient(url, anonKey),
      role: 'anon'
    });
  }
  
  for (const { name, client, role } of clients) {
    console.log(`\n🧪 Testing with ${name}:`);
    
    try {
      // Test 1: Check if RLS is enabled on signs table
      console.log('   📋 Checking RLS status...');
      const { data: rlsStatus, error: rlsError } = await client
        .rpc('check_rls_status');
      
      if (rlsError && rlsError.code !== '42883') { // Ignore "function does not exist"
        console.log(`   ❌ RLS check error: ${rlsError.message}`);
      }
      
      // Test 2: Read from signs table
      console.log('   📖 Testing read access...');
      const { data: readData, error: readError } = await client
        .from('signs')
        .select('gloss, id')
        .limit(1);
      
      if (readError) {
        console.log(`   ❌ Read failed: ${readError.message}`);
      } else {
        console.log(`   ✅ Read successful: ${readData?.length || 0} records`);
      }
      
      // Test 3: Try to update a record
      console.log('   ✏️  Testing update access...');
      const { data: updateData, error: updateError } = await client
        .from('signs')
        .update({ 
          metadata: { 
            test_update: new Date().toISOString(),
            role: role 
          } 
        })
        .eq('gloss', 'HELLO')
        .select();
      
      if (updateError) {
        console.log(`   ❌ Update failed: ${updateError.message}`);
        console.log(`   🔍 Error code: ${updateError.code}`);
        console.log(`   📝 Error details: ${updateError.details}`);
        console.log(`   💡 Error hint: ${updateError.hint}`);
      } else {
        console.log(`   ✅ Update successful: ${updateData?.length || 0} rows affected`);
      }
      
      // Test 4: Check current user context
      console.log('   👤 Checking user context...');
      const { data: userData, error: userError } = await client.auth.getUser();
      
      if (userError) {
        console.log(`   ℹ️  No authenticated user (using ${role} role)`);
      } else {
        console.log(`   👤 Authenticated user: ${userData.user?.email || 'unknown'}`);
      }
      
    } catch (err) {
      console.log(`   ❌ Unexpected error: ${err.message}`);
    }
  }
  
  // Test with SQL queries to check RLS policies directly
  if (serviceKey) {
    console.log('\n🔍 Checking RLS policies with service role...');
    const serviceClient = createClient(url, serviceKey);
    
    try {
      // Check if RLS is enabled
      const { data: rlsEnabled, error: rlsError } = await serviceClient
        .rpc('sql', {
          query: `
            SELECT schemaname, tablename, rowsecurity 
            FROM pg_tables 
            WHERE tablename = 'signs' AND schemaname = 'public';
          `
        });
      
      if (!rlsError && rlsEnabled) {
        console.log('   📊 RLS Status:', rlsEnabled);
      }
      
      // Check existing policies
      const { data: policies, error: policyError } = await serviceClient
        .rpc('sql', {
          query: `
            SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
            FROM pg_policies 
            WHERE tablename = 'signs' AND schemaname = 'public';
          `
        });
      
      if (!policyError && policies) {
        console.log('   🔒 RLS Policies:');
        policies.forEach(policy => {
          console.log(`      ${policy.policyname}: ${policy.cmd} for ${policy.roles?.join(', ') || 'all'}`);
        });
      }
      
    } catch (err) {
      console.log(`   ❌ SQL query failed: ${err.message}`);
    }
  }
}

async function fixRLSPolicies() {
  console.log('\n🔧 Attempting to fix RLS policies...');
  
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey) {
    console.log('❌ Service role key required to modify RLS policies');
    console.log('💡 Please add SUPABASE_SERVICE_ROLE_KEY to your .env file');
    return false;
  }
  
  const client = createClient(url, serviceKey);
  
  try {
    console.log('   🔓 Creating permissive update policy for anon role...');
    
    // Enable RLS if not already enabled
    const enableRLS = `ALTER TABLE public.signs ENABLE ROW LEVEL SECURITY;`;
    
    // Create a permissive policy for updates
    const createPolicy = `
      CREATE POLICY IF NOT EXISTS "Allow anon updates on signs" 
      ON public.signs 
      FOR UPDATE 
      TO anon 
      USING (true) 
      WITH CHECK (true);
    `;
    
    // Also ensure select policy exists
    const createSelectPolicy = `
      CREATE POLICY IF NOT EXISTS "Allow anon selects on signs" 
      ON public.signs 
      FOR SELECT 
      TO anon 
      USING (true);
    `;
    
    // Execute the policies
    for (const [name, query] of [
      ['Enable RLS', enableRLS],
      ['Create Update Policy', createPolicy],
      ['Create Select Policy', createSelectPolicy]
    ]) {
      console.log(`   📝 ${name}...`);
      
      const { error } = await client.rpc('sql', { query });
      
      if (error) {
        console.log(`   ❌ ${name} failed: ${error.message}`);
      } else {
        console.log(`   ✅ ${name} successful`);
      }
    }
    
    return true;
    
  } catch (err) {
    console.log(`   ❌ Error fixing RLS: ${err.message}`);
    return false;
  }
}

async function main() {
  const command = process.argv[2];
  
  try {
    if (command === 'fix') {
      await debugRLS();
      console.log('\n' + '='.repeat(50));
      const fixed = await fixRLSPolicies();
      if (fixed) {
        console.log('\n🎉 RLS policies updated! Try running your update script again.');
      }
    } else {
      await debugRLS();
      console.log('\n💡 To attempt automatic fix, run: node scripts/debug-rls.js fix');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


