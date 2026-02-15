import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkLogs() {
  // Check recent ai_usage entries
  console.log('=== RECENT AI USAGE (last 15) ===\n')
  const { data: usage, error: usageError } = await supabase
    .from('ai_usage')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15)

  if (usageError) {
    console.error('Error fetching ai_usage:', usageError)
  } else if (usage) {
    for (const row of usage) {
      console.log(`${row.created_at} | model: ${row.model} | action: ${row.action} | subject: ${row.subject} | topic: ${row.topic} | tokens: ${row.total_tokens} | cost: $${row.cost_credits} | latency: ${row.latency_ms}ms`)
    }
  }

  // Check recent lessons table for geometry
  console.log('\n=== RECENT LESSONS (last 10) ===\n')
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('subject, topic, model, is_fallback, created_at, content_type')
    .order('created_at', { ascending: false })
    .limit(10)

  if (lessonsError) {
    console.error('Error fetching lessons:', lessonsError)
  } else if (lessons) {
    for (const row of lessons) {
      console.log(`${row.created_at} | model: ${row.model} | fallback: ${row.is_fallback} | ${row.subject} / ${row.topic} | type: ${row.content_type}`)
    }
  }

  // Check for geometry specifically
  console.log('\n=== GEOMETRY REQUESTS ===\n')
  const { data: geoUsage, error: geoError } = await supabase
    .from('ai_usage')
    .select('*')
    .or('topic.ilike.%geometry%,topic.ilike.%Geometry%,subject.ilike.%geometry%')
    .order('created_at', { ascending: false })
    .limit(5)

  if (geoError) {
    console.error('Error fetching geometry usage:', geoError)
  } else if (geoUsage && geoUsage.length > 0) {
    for (const row of geoUsage) {
      console.log(`${row.created_at} | model: ${row.model} | action: ${row.action} | subject: ${row.subject} | topic: ${row.topic} | tokens: ${row.total_tokens} | cost: $${row.cost_credits} | latency: ${row.latency_ms}ms`)
    }
  } else {
    console.log('No geometry requests found in ai_usage table (request may have failed before tracking)')
  }
}

checkLogs()
