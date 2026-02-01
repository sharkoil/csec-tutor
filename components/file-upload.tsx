'use client'

import { useCallback, useState } from 'react'
import { Upload, X, File, Image, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PlanAttachment } from '@/types'

interface FileUploadProps {
  onFilesChange: (files: PlanAttachment[]) => void
  files: PlanAttachment[]
  userId?: string
  maxFiles?: number
  disabled?: boolean
}

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) {
    return <Image className="h-5 w-5 text-blue-500" />
  }
  if (type === 'application/pdf') {
    return <FileText className="h-5 w-5 text-red-500" />
  }
  return <File className="h-5 w-5 text-gray-500" />
}

export function FileUpload({ 
  onFilesChange, 
  files, 
  userId,
  maxFiles = 5,
  disabled = false 
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `${file.name}: File type not allowed. Use PDF, Word, or images.`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: File too large. Maximum size is 10MB.`
    }
    return null
  }

  const uploadFiles = async (fileList: File[]) => {
    if (files.length + fileList.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      for (const file of fileList) {
        const validationError = validateFile(file)
        if (validationError) {
          setError(validationError)
          setIsUploading(false)
          return
        }
        formData.append('files', file)
      }
      formData.append('userId', userId || 'anonymous')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      onFilesChange([...files, ...result.files])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (disabled || isUploading) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      uploadFiles(droppedFiles)
    }
  }, [disabled, isUploading, files, onFilesChange, userId])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !isUploading) {
      setIsDragging(true)
    }
  }, [disabled, isUploading])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      uploadFiles(selectedFiles)
    }
    // Reset input
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-all',
          isDragging && 'border-blue-500 bg-blue-50',
          !isDragging && 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed',
          isUploading && 'pointer-events-none'
        )}
      >
        <input
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled || isUploading}
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" />
            <p className="text-sm text-gray-600">Uploading files...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className={cn(
              'h-10 w-10 mb-3',
              isDragging ? 'text-blue-500' : 'text-gray-400'
            )} />
            <p className="text-sm font-medium text-gray-700 mb-1">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-xs text-gray-500 mb-3">
              or click to browse
            </p>
            <p className="text-xs text-gray-400">
              PDF, Word, PNG, JPG up to 10MB each (max {maxFiles} files)
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Attached Files ({files.length}/{maxFiles})
          </p>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {file.type.startsWith('image/') && file.url.startsWith('data:') ? (
                    <img 
                      src={file.url} 
                      alt={file.name}
                      className="h-10 w-10 object-cover rounded"
                    />
                  ) : (
                    getFileIcon(file.type)
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
