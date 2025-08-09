/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
// Load env from project root and frontend if present
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './frontend/.env' });

const GLOSSES = [
  'HELLO', 'THANK-YOU', 'PLEASE', 'SORRY', 'YES',
  'NO', 'HELP', 'NAME', 'GOOD', 'WATER'
];

function generateSyntheticFrames(frameCount = 30) {
  const frames = [];
  const baseX = Math.random() * 0.2 + 0.4;
  const baseY = Math.random() * 0.2 + 0.3;
  for (let i = 0; i < frameCount; i++) {
    const t = i / frameCount;
    const hand = [];
    for (let j = 0; j < 21; j++) {
      hand.push({
        x: baseX + 0.05 * Math.sin(t * Math.PI * 2 + j * 0.1),
        y: baseY + 0.05 * Math.cos(t * Math.PI * 2 + j * 0.1),
        z: 0.0,
        confidence: 0.95
      });
    }
    frames.push({ timestamp: Math.floor(t * 2000), landmarks: [hand], handedness: ['Right'] });
  }
  return frames;
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Env check failed. Have:');
    console.error('VITE_SUPABASE_URL=', process.env.VITE_SUPABASE_URL);
    console.error('SUPABASE_URL=', process.env.SUPABASE_URL);
    console.error('SUPABASE_SERVICE_ROLE_KEY set? ', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
    console.error('VITE_SUPABASE_ANON_KEY set? ', Boolean(process.env.VITE_SUPABASE_ANON_KEY));
    throw new Error('Missing Supabase env. Provide VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (preferred) or VITE_SUPABASE_ANON_KEY.');
  }
  const supabase = createClient(url, key);

  for (const gloss of GLOSSES) {
    const exemplar = {
      startTime: 0,
      endTime: 2000,
      duration: 2000,
      frameRate: 30,
      frames: generateSyntheticFrames(30),
      metadata: { width: 1280, height: 720, frameCount: 30, source: 'synthetic' }
    };

    // Upsert by gloss; if table lacks unique constraint, this will insert duplicates
    const { data, error } = await supabase
      .from('signs')
      .upsert(
        {
          gloss,
          exemplar_landmarks: exemplar,
          metadata: { source: 'synthetic', license: 'demo', fps: 30 }
        },
        { onConflict: 'gloss' }
      )
      .select();

    if (error) {
      console.error('Failed to upsert', gloss, error.message);
      process.exitCode = 1;
    } else {
      console.log('Upserted', gloss, data && data[0] && data[0].id);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


