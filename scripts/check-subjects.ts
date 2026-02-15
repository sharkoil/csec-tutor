import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  try {
    // Use a simple approach: grab subjects in small pages
    const counts: Record<string, number> = {};
    let from = 0;
    const pageSize = 1000;
    let total = 0;

    while (true) {
      const { data, error } = await sb
        .from('csec_content')
        .select('subject')
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error:', JSON.stringify(error));
        break;
      }
      if (!data || data.length === 0) break;
      
      for (const r of data) {
        counts[r.subject] = (counts[r.subject] || 0) + 1;
      }
      total += data.length;
      
      if (data.length < pageSize) break;
      from += pageSize;
    }

    console.log(`\n=== SUBJECTS IN VECTOR DB (${total} chunks fetched) ===\n`);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    for (const [subject, count] of sorted) {
      console.log(`  ${subject.padEnd(45)} ${count} chunks`);
    }
    console.log(`\n  TOTAL: ${sorted.length} subjects`);

    // Show topics for specific subjects
    for (const target of ['Geography', 'Social Studies']) {
      const topicCounts: Record<string, number> = {};
      let tFrom = 0;
      while (true) {
        const { data: td } = await sb
          .from('csec_content')
          .select('topic')
          .eq('subject', target)
          .range(tFrom, tFrom + 999);
        if (!td || td.length === 0) break;
        for (const r of td) {
          topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1;
        }
        if (td.length < 1000) break;
        tFrom += 1000;
      }
      console.log(`\n--- ${target} topics ---`);
      for (const [t, c] of Object.entries(topicCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${t.padEnd(50)} ${c}`);
      }
    }
  } catch (err) {
    console.error('Uncaught error:', err);
  }
}

main().catch(console.error);
