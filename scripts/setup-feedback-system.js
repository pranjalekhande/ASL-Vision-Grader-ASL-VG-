/**
 * Script to set up the feedback system database tables
 * Run this to enable full teacher feedback functionality
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// You'll need to update these with your actual Supabase credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration(filename) {
  try {
    console.log(`\n🔄 Running migration: ${filename}`);
    
    const migrationPath = path.join(__dirname, '../frontend/src/config/migrations', filename);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    const { error } = await supabase.rpc('execute_sql', { sql_query: sql });
    
    if (error) {
      console.error(`❌ Migration ${filename} failed:`, error.message);
      return false;
    } else {
      console.log(`✅ Migration ${filename} completed successfully`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error running migration ${filename}:`, error.message);
    return false;
  }
}

async function setupFeedbackSystem() {
  console.log('🚀 Setting up ASL Vision Grader Feedback System...\n');
  
  // Check if we can connect to Supabase
  try {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    console.log('✅ Connected to Supabase successfully');
  } catch (error) {
    console.error('❌ Cannot connect to Supabase. Please check your credentials:');
    console.error('   - VITE_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('Error:', error.message);
    process.exit(1);
  }

  // Run migrations in order
  const migrations = [
    '006_create_feedback_system.sql',
    '007_create_analytics_views.sql'
  ];

  let allSucceeded = true;
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (!success) {
      allSucceeded = false;
      break;
    }
  }

  if (allSucceeded) {
    console.log('\n🎉 Feedback system setup completed successfully!');
    console.log('\nNow you can:');
    console.log('📹 Review student videos with advanced controls');
    console.log('💬 Add timestamped feedback comments');
    console.log('📊 View detailed analytics');
    console.log('🎯 Track student progress over time');
  } else {
    console.log('\n❌ Setup failed. Please check the errors above.');
    process.exit(1);
  }
}

// Alternative method using direct SQL execution (if RPC doesn't work)
async function executeSQL(sql) {
  // This would require a direct database connection
  // For now, we'll provide instructions to run manually
  console.log('\n📋 Manual Setup Instructions:');
  console.log('If the automatic setup fails, you can run these SQL commands manually in your Supabase SQL editor:\n');
  
  const migrations = [
    '006_create_feedback_system.sql',
    '007_create_analytics_views.sql'
  ];
  
  migrations.forEach(filename => {
    const migrationPath = path.join(__dirname, '../frontend/src/config/migrations', filename);
    if (fs.existsSync(migrationPath)) {
      console.log(`--- Content of ${filename} ---`);
      console.log(fs.readFileSync(migrationPath, 'utf8'));
      console.log('\n' + '='.repeat(80) + '\n');
    }
  });
}

// Check if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupFeedbackSystem().catch(console.error);
}

export { setupFeedbackSystem, executeSQL };
