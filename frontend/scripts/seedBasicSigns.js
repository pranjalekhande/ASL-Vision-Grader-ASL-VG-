// Simple script to seed the database with basic test signs
// Run this after setting up your .env file and database

import { createClient } from '@supabase/supabase-js';

// Basic signs to seed
const BASIC_SIGNS = [
  {
    name: 'Hello',
    description: 'A friendly greeting. Wave your open hand near your head with palm facing outward.',
    difficulty: 1,
    common_mistakes: {
      handshape: ['Fingers too close together', 'Palm facing wrong direction'],
      movement: ['Not waving', 'Waving too far from head'],
      location: ['Hand too low', 'Hand too far from face']
    }
  },
  {
    name: 'Thank You',
    description: 'Touch your chin or lips with your fingertips, then move your hand forward and down.',
    difficulty: 1,
    common_mistakes: {
      handshape: ['Fingers spread too wide', 'Using wrong hand orientation'],
      movement: ['Movement too abrupt', 'Not moving forward enough'],
      location: ['Starting too far from chin', 'Ending position too high']
    }
  },
  {
    name: 'Please',
    description: 'Place your open hand on your chest and move it in a circular motion.',
    difficulty: 2,
    common_mistakes: {
      handshape: ['Hand too tense', 'Fingers not flat enough'],
      movement: ['Circle too small', 'Not enough rotations'],
      location: ['Hand too high/low on chest', 'Movement not centered']
    }
  },
  {
    name: 'Sorry',
    description: 'Make a fist and rub it in a circular motion on your chest.',
    difficulty: 2,
    common_mistakes: {
      handshape: ['Fist too loose', 'Wrong finger position'],
      movement: ['Movement too fast', 'Circle not clear'],
      location: ['Wrong position on chest', 'Hand angle incorrect']
    }
  },
  {
    name: 'Good',
    description: 'Place your right hand flat against your lips, then move it down and away.',
    difficulty: 1,
    common_mistakes: {
      handshape: ['Fingers not together', 'Palm not flat'],
      movement: ['Movement too fast', 'Not moving outward enough'],
      location: ['Starting too far from lips', 'Wrong hand angle']
    }
  }
];

async function seedBasicSigns() {
  // Get environment variables
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables:');
    console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing');
    console.error('\nPlease create a .env file in the frontend directory with these values.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🌱 Seeding basic signs...');

  try {
    // Check if signs already exist
    const { data: existingSigns, error: checkError } = await supabase
      .from('signs')
      .select('name')
      .limit(1);

    if (checkError) {
      console.error('❌ Database connection failed:', checkError.message);
      console.error('\nMake sure you have:');
      console.error('1. Created a Supabase project');
      console.error('2. Run the database-setup.sql script');
      console.error('3. Set correct environment variables');
      process.exit(1);
    }

    if (existingSigns && existingSigns.length > 0) {
      console.log('ℹ️  Signs already exist in database. Skipping seed.');
      
      // Show existing signs
      const { data: allSigns } = await supabase
        .from('signs')
        .select('name, difficulty, created_at')
        .order('created_at', { ascending: false });
      
      if (allSigns && allSigns.length > 0) {
        console.log('\n📋 Existing signs:');
        allSigns.forEach(sign => {
          console.log(`   • ${sign.name} (Difficulty: ${sign.difficulty})`);
        });
      }
      
      return;
    }

    // Insert the basic signs
    const { data: insertedSigns, error: insertError } = await supabase
      .from('signs')
      .insert(
        BASIC_SIGNS.map(sign => ({
          name: sign.name,
          description: sign.description,
          difficulty: sign.difficulty,
          common_mistakes: sign.common_mistakes,
          // Use empty array for exemplar_landmarks to satisfy NOT NULL constraint
          exemplar_landmarks: [],
          metadata: {
            seedData: true,
            createdAt: new Date().toISOString()
          }
        }))
      )
      .select();

    if (insertError) {
      console.error('❌ Failed to insert signs:', insertError.message);
      process.exit(1);
    }

    console.log(`✅ Successfully seeded ${insertedSigns.length} basic signs:`);
    insertedSigns.forEach(sign => {
      console.log(`   • ${sign.name} (Difficulty: ${sign.difficulty})`);
    });

    console.log('\n🎉 Database seeding complete!');
    console.log('\nNext steps:');
    console.log('1. Start your development server: npm run dev');
    console.log('2. Log in as a student to see the signs');
    console.log('3. Log in as a teacher to record reference videos');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run the seeder
seedBasicSigns();
