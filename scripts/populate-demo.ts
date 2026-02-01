import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Demo CSEC content without requiring OpenRouter
const demoContent = [
  {
    subject: 'mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    content_type: 'syllabus',
    content: 'Students should be able to solve linear equations in one variable, including equations with brackets and fractions. They should understand the concept of solution and be able to verify solutions by substitution.',
    metadata: { difficulty: 'medium' },
    embedding: Array(1536).fill(0.1) // Simple dummy embedding
  },
  {
    subject: 'mathematics',
    topic: 'Algebra', 
    subtopic: 'Linear Equations',
    content_type: 'question',
    content: 'Solve the equation 3x + 7 = 22. Show all working steps.',
    metadata: { year: 2024, paper_number: 'P1', difficulty: 'easy', question_type: 'short_answer', marks: 3 },
    embedding: Array(1536).fill(0.2)
  },
  {
    subject: 'mathematics',
    topic: 'Algebra',
    subtopic: 'Linear Equations',
    content_type: 'explanation',
    content: 'To solve 3x + 7 = 22, first subtract 7 from both sides: 3x = 15. Then divide both sides by 3: x = 5. Always check your answer by substituting back into the original equation: 3(5) + 7 = 15 + 7 = 22 ✓',
    metadata: { difficulty: 'easy' },
    embedding: Array(1536).fill(0.15)
  },
  {
    subject: 'mathematics',
    topic: 'Geometry',
    subtopic: 'Triangles',
    content_type: 'syllabus',
    content: 'Students should understand the properties of triangles, including angle sum property, types of triangles, and Pythagorean theorem for right-angled triangles.',
    metadata: { difficulty: 'medium' },
    embedding: Array(1536).fill(0.1)
  },
  {
    subject: 'mathematics',
    topic: 'Geometry',
    subtopic: 'Triangles',
    content_type: 'question',
    content: 'In triangle ABC, if angle A = 60° and angle B = 70°, find the measure of angle C.',
    metadata: { year: 2024, paper_number: 'P1', difficulty: 'easy', question_type: 'short_answer', marks: 2 },
    embedding: Array(1536).fill(0.2)
  },
  {
    subject: 'biology',
    topic: 'Cell Structure',
    subtopic: 'Cell Organelles',
    content_type: 'syllabus',
    content: 'Students should understand the structure and function of various cell organelles including nucleus, mitochondria, chloroplasts, ribosomes, and cell membrane.',
    metadata: { difficulty: 'medium' },
    embedding: Array(1536).fill(0.1)
  },
  {
    subject: 'biology',
    topic: 'Cell Structure',
    subtopic: 'Cell Organelles',
    content_type: 'question',
    content: 'Describe the function of mitochondria in a cell.',
    metadata: { year: 2024, paper_number: 'P2', difficulty: 'medium', question_type: 'structured', marks: 4 },
    embedding: Array(1536).fill(0.25)
  }
]

async function populateWithServiceRole() {
  console.log('🚀 Populating database with demo CSEC content...')
  console.log('🔧 Using service role key for admin operations')
  console.log('')
  
  try {
    let successCount = 0
    
    for (const content of demoContent) {
      try {
        const { data, error } = await supabase
          .from('csec_content')
          .insert(content)
          .select()
          .single()
        
        if (error) {
          console.error(`  ❌ Failed to add ${content.content_type}:`, error.message)
        } else {
          console.log(`  ✅ Added ${content.subject} - ${content.topic} - ${content.content_type}`)
          successCount++
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 200))
        
      } catch (err) {
        console.error(`  ❌ Error processing content:`, err)
      }
    }
    
    console.log('')
    console.log('🎉 Demo content population completed!')
    console.log(`📊 Results: ${successCount}/${demoContent.length} items added successfully`)
    console.log('')
    console.log('✅ Your CSEC database is ready for testing!')
    console.log('')
    console.log('🚀 Next steps:')
    console.log('1. Start the application: npm run dev')
    console.log('2. Go to: http://localhost:3000')
    console.log('3. Create an account and study plan')
    console.log('4. Test the search and coaching features')
    console.log('')
    console.log('🎓 Available Content:')
    console.log('  • Mathematics: Algebra, Geometry')
    console.log('  • Biology: Cell Structure')
    console.log('  • Types: Syllabus, Questions, Explanations')
    console.log('  • Total: 6 content items')
    
  } catch (error) {
    console.error('❌ Population failed:', error)
  }
}

populateWithServiceRole().catch(console.error)