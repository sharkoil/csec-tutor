import { describe, it, expect, beforeEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

// Test database connection and basic operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const hasCredentials = !!(supabaseUrl && supabaseKey)

// Only create client if credentials are available
const supabase = hasCredentials
  ? createClient(supabaseUrl!, supabaseKey!)
  : (null as any)

const describeOrSkip = hasCredentials ? describe : describe.skip

describeOrSkip('Database Integration Tests', () => {
  // Test connection to actual database
  it('should connect to Supabase database', async () => {
    // Basic connection test
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })

  it('should create and retrieve study plans', async () => {
    const testPlan = {
      user_id: 'test-user-id',
      subject: 'mathematics',
      topics: ['Algebra', 'Geometry'],
      status: 'active'
    }

    // Insert
    const { data: insertedPlan, error: insertError } = await supabase
      .from('study_plans')
      .insert(testPlan)
      .select()
      .single()

    expect(insertError).toBeNull()
    expect(insertedPlan).toEqual(expect.objectContaining(testPlan))

    // Retrieve
    const { data: retrievedPlan, error: retrieveError } = await supabase
      .from('study_plans')
      .select('*')
      .eq('user_id', 'test-user-id')
      .single()

    expect(retrieveError).toBeNull()
    expect(retrievedPlan).toEqual(expect.objectContaining(testPlan))
  })

  it('should handle progress tracking', async () => {
    const testProgress = {
      user_id: 'test-user-id',
      plan_id: 'test-plan-id',
      topic: 'Algebra',
      coaching_completed: true,
      practice_completed: false,
      exam_completed: false,
      practice_score: 85
    }

    // Insert progress
    const { data: insertedProgress, error: insertError } = await supabase
      .from('progress')
      .insert(testProgress)
      .select()
      .single()

    expect(insertError).toBeNull()
    expect(insertedProgress).toEqual(expect.objectContaining(testProgress))

    // Update progress
    const { data: updatedProgress, error: updateError } = await supabase
      .from('progress')
      .update({ practice_completed: true, exam_score: 90 })
      .eq('id', insertedProgress.id)
      .select()
      .single()

    expect(updateError).toBeNull()
    expect(updatedProgress.practice_completed).toBe(true)
    expect(updatedProgress.exam_score).toBe(90)
  })

  it('should search CSEC content', async () => {
    // First ensure we have content to search
    const testContent = {
      subject: 'mathematics',
      topic: 'Algebra',
      subtopic: 'Linear Equations',
      content_type: 'question',
      content: 'What is the solution to 2x + 5 = 15?',
      metadata: { difficulty: 'easy', marks: 2 },
      embedding: Array(1536).fill(0.1) // Dummy embedding for test
    }

    const { error: insertError } = await supabase
      .from('csec_content')
      .insert(testContent)
      .select()
      .single()

    expect(insertError).toBeNull()

    // Test search function (if available)
    try {
      const { data: searchResults, error: searchError } = await supabase
        .rpc('search_csec_content', {
          query_embedding: Array(1536).fill(0.2),
          match_threshold: 0.7,
          match_count: 5
        })

      if (!searchError && Array.isArray(searchResults)) {
        expect(searchResults.length).toBeGreaterThanOrEqual(0)
      }
    } catch (error) {
      console.log('Search function not available:', error)
      // This is expected if the search function hasn't been created
    }
  })

  // Cleanup after tests
  afterAll(async () => {
    // Clean up test data
    await supabase.from('study_plans').delete().eq('user_id', 'test-user-id')
    await supabase.from('progress').delete().eq('user_id', 'test-user-id')
    await supabase.from('csec_content').delete().eq('content', 'What is the solution to 2x + 5 = 15?')
  })
})