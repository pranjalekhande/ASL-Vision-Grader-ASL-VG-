#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🎯 ASL Vision Grader - Feedback System Database Setup\n');

console.log('This script will help you set up the feedback system database tables.\n');

console.log('📋 What will be updated/created:');
console.log('🔄 Upgrade existing feedback table to enhanced schema');
console.log('✅ Add timestamp_seconds, category, severity columns');
console.log('✅ Create feedback_templates table (if missing)');
console.log('✅ Create feedback_notifications table (if missing)');
console.log('✅ Update RLS policies for security');
console.log('✅ Add database indexes for performance');
console.log('✅ Create helper functions and views\n');

const migrationFile = path.join(__dirname, '..', 'frontend', 'src', 'config', 'migrations', '009_upgrade_feedback_table.sql');

if (!fs.existsSync(migrationFile)) {
  console.error('❌ Migration file not found:', migrationFile);
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf8');

console.log('📝 To set up the feedback system:\n');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Copy and paste the following SQL:\n');
console.log('--- BEGIN SQL ---');
console.log(sql);
console.log('--- END SQL ---\n');

console.log('4. Click "Run" to execute the migration');
console.log('5. Verify the tables were created in the Table Editor\n');

console.log('🔍 Expected tables after migration:');
console.log('  - feedback (with enhanced columns: timestamp_seconds, category, severity)');
console.log('  - feedback_templates');
console.log('  - feedback_notifications\n');

console.log('✨ Once complete, the enhanced feedback system will be fully functional!');
console.log('   Teachers can add timestamped, categorized feedback to student videos.');
console.log('   Students will receive notifications about new feedback.');
console.log('   Existing feedback data will be preserved and migrated.\n');

console.log('💡 Troubleshooting:');
console.log('   If you get permission errors, ensure your user has the required privileges.');
console.log('   If migration fails, check that the feedback table exists first.');
console.log('   This migration is safe to run multiple times.');
