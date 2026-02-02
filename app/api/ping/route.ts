import { NextResponse } from 'next/server'

// Simple ping endpoint to test Vercel deployment
export async function GET() {
  return NextResponse.json({ 
    pong: true, 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
}
