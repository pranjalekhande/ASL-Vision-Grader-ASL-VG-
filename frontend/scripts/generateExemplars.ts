import { generateExemplarDataset, saveExemplarData } from '../src/utils/exemplarGenerator';
import { supabase } from '../src/config/supabase';

async function seedExemplarData() {
  try {
    console.log('Generating exemplar dataset...');
    const dataset = await generateExemplarDataset();
    
    console.log('Saving exemplar data...');
    await saveExemplarData(dataset);

    console.log('Seeding database with exemplars...');
    for (const exemplar of dataset.exemplars) {
      const { error } = await supabase
        .from('signs')
        .upsert({
          id: exemplar.id,
          name: exemplar.name,
          description: exemplar.description,
          difficulty: exemplar.difficulty,
          category: exemplar.category,
          status: exemplar.status,
          tags: exemplar.tags,
          landmarks: exemplar.landmarks,
          created_by: 'system',
          created_at: exemplar.createdAt,
          updated_at: exemplar.updatedAt
        });

      if (error) {
        console.error(`Failed to seed exemplar ${exemplar.name}:`, error);
      } else {
        console.log(`Seeded exemplar: ${exemplar.name}`);
      }
    }

    console.log('Generating synthetic attempts...');
    for (const [sign, attempts] of Object.entries(dataset.syntheticAttempts)) {
      const exemplar = dataset.exemplars.find(e => e.name === sign);
      if (!exemplar) continue;

      for (const [index, landmarks] of attempts.entries()) {
        const { error } = await supabase
          .from('attempts')
          .insert({
            student_id: 'system',
            sign_id: exemplar.id,
            score_shape: 90 - (index * 5), // Decreasing scores for demo
            score_location: 85 - (index * 5),
            score_movement: 88 - (index * 5),
            landmarks,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error(`Failed to seed attempt ${index} for ${sign}:`, error);
        } else {
          console.log(`Seeded attempt ${index} for ${sign}`);
        }
      }
    }

    console.log('Exemplar data seeding complete!');
  } catch (error) {
    console.error('Failed to seed exemplar data:', error);
  }
}

// Run the seeding script
seedExemplarData();


