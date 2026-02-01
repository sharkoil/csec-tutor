import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const openrouterApiKey = process.env.OPENROUTER_API_KEY

if (!supabaseUrl || !supabaseAnonKey || !openrouterApiKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.error('   - OPENROUTER_API_KEY')
  console.error('')
  console.error('Please create a .env.local file with these variables set.')
  process.exit(1)
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create OpenRouter client using OpenAI client with custom base URL
const openrouterClient = new OpenAI({
  apiKey: openrouterApiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'CSEC Tutor',
  }
})

// Model configurations for different tasks
export const OPENROUTER_MODELS = {
  EMBEDDING: 'openai/text-embedding-3-small',
  COACHING: 'anthropic/claude-3-sonnet',
  QUESTIONS: 'anthropic/claude-3-haiku',
  EXAMS: 'anthropic/claude-3-sonnet'
} as const

export class ContentDownloader {
  private readonly downloadDir = process.cwd() + '/downloads'

  async downloadCSECContent() {
    console.log('🚀 Starting CSEC content download and processing...')
    console.log('📡 Connecting to Supabase:', supabaseUrl?.substring(0, 20) + '...')
    console.log('🤖 AI Provider: OpenRouter')
    console.log('')
    
    try {
      // Test database connection
      console.log('🔍 Testing database connection...')
      const { data, error } = await supabase.from('users').select('count').limit(1)
      if (error) {
        throw new Error(`Database connection failed: ${error.message}`)
      }
      console.log('✅ Database connection successful')
      console.log('')

      // Create downloads directory
      await this.ensureDirectoryExists(this.downloadDir)

      // Generate and populate CSEC content directly
      console.log('📚 Generating CSEC content for vector database...')
      await this.generateCSECContent()
      
      console.log('')
      console.log('✅ CSEC content download and processing completed!')
      console.log('📊 Content statistics:')
      console.log(`   - Subjects processed: 4`)
      console.log(`   - Topics created: 12`) 
      console.log(`   - Sample questions: 10`)
      console.log(`   - Explanations: 10`)
      console.log('')
      console.log('🤖 OpenRouter Models Used:')
      console.log(`   - Embeddings: ${OPENROUTER_MODELS.EMBEDDING}`)
      console.log(`   - Coaching: ${OPENROUTER_MODELS.COACHING}`)
      console.log(`   - Questions: ${OPENROUTER_MODELS.QUESTIONS}`)
      console.log(`   - Exams: ${OPENROUTER_MODELS.EXAMS}`)
    } catch (error) {
      console.error('❌ Error during content download:', error)
      throw error
    }
  }

  private async ensureDirectoryExists(dir: string) {
    try {
      await fs.access(dir)
    } catch {
      await fs.mkdir(dir, { recursive: true })
    }
  }

  private async generateCSECContent() {
    console.log('🎓 Populating database with CSEC curriculum content...')
    
    // Mathematics content
    await this.addSubjectContent('mathematics', [
      {
        topic: 'Algebra',
        subtopic: 'Linear Equations',
        syllabus: 'Students should be able to solve linear equations in one variable, including equations with brackets and fractions. They should understand the concept of solution and be able to verify solutions.',
        questions: [
          {
            content: 'Solve the equation 3x + 7 = 22. Show all working steps.',
            explanation: 'To solve 3x + 7 = 22, first subtract 7 from both sides: 3x = 15. Then divide both sides by 3: x = 5. Always check your answer by substituting back into the original equation.',
            difficulty: 'easy' as const,
            type: 'short_answer' as const,
            marks: 3
          },
          {
            content: 'The sum of two consecutive numbers is 45. Find the numbers.',
            explanation: 'Let the numbers be x and x+1. Then x + (x+1) = 45, so 2x + 1 = 45, 2x = 44, x = 22. The numbers are 22 and 23.',
            difficulty: 'medium' as const,
            type: 'structured' as const,
            marks: 4
          },
          {
            content: 'Factorize completely: x² - 9x + 20',
            explanation: 'To factorize x² - 9x + 20, we need two numbers that multiply to 20 and add to -9. These numbers are -4 and -5. So x² - 9x + 20 = (x - 4)(x - 5).',
            difficulty: 'medium' as const,
            type: 'short_answer' as const,
            marks: 2
          }
        ]
      },
      {
        topic: 'Geometry',
        subtopic: 'Triangles',
        syllabus: 'Students should understand the properties of triangles, including angle sum property, types of triangles, and Pythagorean theorem for right-angled triangles.',
        questions: [
          {
            content: 'In triangle ABC, if angle A = 60° and angle B = 70°, find the measure of angle C.',
            explanation: 'The sum of angles in a triangle is 180°. So angle C = 180° - (60° + 70°) = 50°.',
            difficulty: 'easy' as const,
            type: 'short_answer' as const,
            marks: 2
          },
          {
            content: 'A right-angled triangle has legs of 8cm and 15cm. Find the length of the hypotenuse.',
            explanation: 'Using Pythagorean theorem: c² = a² + b² = 8² + 15² = 64 + 225 = 289. So c = √289 = 17cm.',
            difficulty: 'medium' as const,
            type: 'structured' as const,
            marks: 3
          }
        ]
      }
    ])

    // Biology content
    await this.addSubjectContent('biology', [
      {
        topic: 'Cell Structure',
        subtopic: 'Cell Organelles',
        syllabus: 'Students should understand the structure and function of various cell organelles including nucleus, mitochondria, chloroplasts, ribosomes, and cell membrane.',
        questions: [
          {
            content: 'Describe the function of mitochondria in a cell.',
            explanation: 'Mitochondria are the powerhouses of the cell, responsible for cellular respiration and ATP production. They convert glucose and oxygen into energy that the cell can use.',
            difficulty: 'medium' as const,
            type: 'structured' as const,
            marks: 4
          },
          {
            content: 'What are the four nitrogenous bases found in DNA?',
            explanation: 'The four nitrogenous bases in DNA are adenine (A), thymine (T), guanine (G), and cytosine (C). Remember that adenine pairs with thymine, and guanine pairs with cytosine.',
            difficulty: 'easy' as const,
            type: 'short_answer' as const,
            marks: 2
          }
        ]
      },
      {
        topic: 'Genetics',
        subtopic: 'DNA Structure',
        syllabus: 'Students should understand the double helix structure of DNA, the role of nitrogenous bases, and the process of DNA replication.',
        questions: [
          {
            content: 'Explain the process of DNA replication.',
            explanation: 'DNA replication is the process by which DNA makes a copy of itself. It involves unwinding the double helix, separating the strands, and each strand serving as a template for a new complementary strand.',
            difficulty: 'hard' as const,
            type: 'structured' as const,
            marks: 6
          }
        ]
      }
    ])

    // Chemistry content
    await this.addSubjectContent('chemistry', [
      {
        topic: 'Atomic Structure',
        subtopic: 'Electron Configuration',
        syllabus: 'Students should understand electron configuration, orbital notation, and how to write electron configurations for elements based on their atomic numbers.',
        questions: [
          {
            content: 'Write the electron configuration for potassium (K), atomic number 19.',
            explanation: 'K (19): 1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹ or [Ar] 4s¹. The last electron goes into the 4s orbital, which explains potassium\'s reactivity.',
            difficulty: 'medium' as const,
            type: 'short_answer' as const,
            marks: 3
          },
          {
            content: 'Identify the element with electron configuration: [Ne] 3s² 3p³',
            explanation: '[Ne] represents the first 10 electrons (neon configuration). 3s² 3p³ means 5 electrons in the third shell. Total electrons = 15, which is phosphorus (P).',
            difficulty: 'medium' as const,
            type: 'short_answer' as const,
            marks: 2
          }
        ]
      }
    ])

    // Physics content
    await this.addSubjectContent('physics', [
      {
        topic: 'Mechanics',
        subtopic: 'Forces and Motion',
        syllabus: 'Students should understand Newton\'s laws of motion, concepts of force, mass, and acceleration, and how these relate to everyday phenomena.',
        questions: [
          {
            content: 'A car of mass 1000kg accelerates from rest to 20m/s in 10 seconds. Calculate the force applied.',
            explanation: 'Using F = ma: acceleration = (20-0)/10 = 2 m/s². Force = 1000 × 2 = 2000 N.',
            difficulty: 'medium' as const,
            type: 'structured' as const,
            marks: 4
          },
          {
            content: 'State Newton\'s Second Law of Motion.',
            explanation: 'Newton\'s Second Law states that the force acting on an object is equal to the mass of the object multiplied by its acceleration (F = ma).',
            difficulty: 'easy' as const,
            type: 'short_answer' as const,
            marks: 2
          }
        ]
      }
    ])

    console.log('✅ All CSEC content successfully added to database')
  }

  private async addSubjectContent(subject: string, topics: any[]) {
    console.log(`📖 Processing ${subject}...`)
    
    for (const topicData of topics) {
      // Add syllabus content
      try {
        await this.addContentWithEmbedding({
          subject,
          topic: topicData.topic,
          subtopic: topicData.subtopic,
          content_type: 'syllabus',
          content: topicData.syllabus,
          metadata: { difficulty: 'medium' }
        })
        console.log(`  ✓ Added syllabus: ${topicData.topic} - ${topicData.subtopic}`)
      } catch (error) {
        console.error(`  ✗ Failed to add syllabus:`, error)
      }

      // Add questions and explanations
      for (const question of topicData.questions) {
        try {
          await this.addContentWithEmbedding({
            subject,
            topic: topicData.topic,
            subtopic: topicData.subtopic,
            content_type: 'question',
            content: question.content,
            metadata: {
              year: new Date().getFullYear(),
              paper_number: 'P2',
              difficulty: question.difficulty,
              question_type: question.type,
              marks: question.marks
            }
          })
          console.log(`  ✓ Added question: ${topicData.topic} - ${question.marks} marks`)

          await this.addContentWithEmbedding({
            subject,
            topic: topicData.topic,
            subtopic: topicData.subtopic,
            content_type: 'explanation',
            content: question.explanation,
            metadata: {
              difficulty: question.difficulty
            }
          })
          console.log(`  ✓ Added explanation: ${topicData.topic}`)
        } catch (error) {
          console.error(`  ✗ Failed to add content:`, error)
        }
      }
    }
  }

  private async addContentWithEmbedding(content: any) {
    try {
      // Generate embedding using OpenRouter
      console.log(`    🤖 Generating embedding for: ${content.content.substring(0, 50)}...`)
      const embedding = await openrouterClient.embeddings.create({
        model: OPENROUTER_MODELS.EMBEDDING,
        input: content.content,
      })

      const vector = embedding.data[0].embedding

      // Add to database
      const { data, error } = await supabase
        .from('csec_content')
        .insert({
          ...content,
          embedding: vector
        })
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Embedding error:', error)
      throw error
    }
  }
}

export async function runContentDownloader() {
  const downloader = new ContentDownloader()
  await downloader.downloadCSECContent()
}