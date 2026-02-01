import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const userId = formData.get('userId') as string

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()
    const uploadedFiles: { name: string; url: string; type: string; size: number }[] = []

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type} not allowed. Allowed types: PDF, Word, PNG, JPG, WebP` },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        )
      }

      // If Supabase is available, upload to storage
      if (supabase) {
        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${userId || 'anonymous'}/${timestamp}_${sanitizedName}`

        const arrayBuffer = await file.arrayBuffer()
        const buffer = new Uint8Array(arrayBuffer)

        const { data, error } = await supabase.storage
          .from('study-materials')
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: false
          })

        if (error) {
          console.error('Supabase upload error:', error)
          // Fall back to base64 if Supabase fails
          const base64 = Buffer.from(arrayBuffer).toString('base64')
          uploadedFiles.push({
            name: file.name,
            url: `data:${file.type};base64,${base64}`,
            type: file.type,
            size: file.size
          })
        } else {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('study-materials')
            .getPublicUrl(data.path)

          uploadedFiles.push({
            name: file.name,
            url: urlData.publicUrl,
            type: file.type,
            size: file.size
          })
        }
      } else {
        // No Supabase - use base64 encoding as fallback
        const arrayBuffer = await file.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        
        uploadedFiles.push({
          name: file.name,
          url: `data:${file.type};base64,${base64}`,
          type: file.type,
          size: file.size
        })
      }
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    )
  }
}
