import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log('=== student_metrics ===')
  const { data: m, error: me } = await sb.from('student_metrics').select('*').limit(5)
  if (me) console.error('ERROR:', me.message)
  else console.log(m?.length ? JSON.stringify(m, null, 2) : '(empty)')

  console.log('\n=== daily_activity ===')
  const { data: d, error: de } = await sb.from('daily_activity').select('*').limit(5)
  if (de) console.error('ERROR:', de.message)
  else console.log(d?.length ? JSON.stringify(d, null, 2) : '(empty)')

  console.log('\n=== quiz_results ===')
  const { data: q, error: qe } = await sb.from('quiz_results').select('*').limit(5)
  if (qe) console.error('ERROR:', qe.message)
  else console.log(q?.length ? JSON.stringify(q, null, 2) : '(empty)')

  console.log('\n=== student_dashboard_summary (view) ===')
  const { data: s, error: se } = await sb.from('student_dashboard_summary').select('*').limit(5)
  if (se) console.error('ERROR:', se.message)
  else console.log(s?.length ? JSON.stringify(s, null, 2) : '(empty)')
}

check()
