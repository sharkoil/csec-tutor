#!/usr/bin/env node

import { runContentDownloader } from '../lib/content-downloader'

console.log('🚀 Starting CSEC Content Download and Processing...')
console.log('This will download and process CSEC syllabuses and past papers')
console.log('')

runContentDownloader()
  .then(() => {
    console.log('')
    console.log('✅ Content download and processing completed successfully!')
    console.log('📚 Your CSEC database is now populated with educational content')
    console.log('🎓 Students can now access AI-powered coaching and practice questions')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('❌ Error during content download:', error)
    console.log('')
    console.log('🔧 Troubleshooting:')
    console.log('  1. Check your internet connection')
    console.log('  2. Verify your OpenAI API key is valid')
    console.log('  3. Ensure Supabase is running and accessible')
    console.log('  4. Check file system permissions')
    process.exit(1)
  })