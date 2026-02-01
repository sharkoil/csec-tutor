'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <Navbar />

      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Logo and title */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-2 mb-6 hover:opacity-80 transition-opacity">
              <div className="bg-gradient-to-br from-primary to-secondary p-3 rounded-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-foreground">CSEC Tutor</h1>
                <p className="text-xs text-muted-foreground">Learn. Practice. Succeed.</p>
              </div>
            </Link>

            <h2 className="text-3xl font-bold text-foreground mb-2">
              {mode === 'signin' ? 'Welcome Back' : 'Start Your Journey'}
            </h2>
            <p className="text-muted-foreground">
              {mode === 'signin' 
                ? 'Continue your CSEC exam preparation' 
                : 'Join thousands of Caribbean students preparing for success'}
            </p>
          </div>

          {/* Auth Form */}
          <div className="mb-6">
            <AuthForm 
              mode={mode} 
              onToggleMode={() => setMode(mode === 'signin' ? 'signup' : 'signin')} 
            />
          </div>

          {/* Mode toggle info */}
          <div className="text-center text-sm text-muted-foreground">
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  className="font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => setMode('signin')}
                  className="font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}