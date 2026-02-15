'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthState, User as AppUser } from '@/types'

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** Check whether a string is a valid UUID (any version). */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Migrate old localStorage mock users that have non-UUID IDs.
 * This runs once on boot — existing plans in localStorage are also patched.
 */
function migrateOldMockUser(): void {
  try {
    const mockUserStr = localStorage.getItem('csec_mock_user')
    if (!mockUserStr) return

    const mockUser = JSON.parse(mockUserStr)
    if (!mockUser.id || isValidUUID(mockUser.id)) return // already good

    const oldId = mockUser.id
    const newId = crypto.randomUUID()
    console.log(`[auth] Migrating mock user ID from ${oldId} to ${newId}`)
    mockUser.id = newId
    localStorage.setItem('csec_mock_user', JSON.stringify(mockUser))

    // Patch locally-stored plans so they reference the new user_id
    const plansStr = localStorage.getItem('csec_mock_plans')
    if (plansStr) {
      try {
        const plans = JSON.parse(plansStr)
        for (const plan of plans) {
          if (plan.user_id === oldId) plan.user_id = newId
        }
        localStorage.setItem('csec_mock_plans', JSON.stringify(plans))
      } catch { /* ignore corrupt data */ }
    }

    // Patch locally-stored progress
    const progressStr = localStorage.getItem('csec_mock_progress')
    if (progressStr) {
      try {
        const progress = JSON.parse(progressStr)
        // Progress keys are "planId_topic" — user_id isn't in the key, so no key migration needed
        localStorage.setItem('csec_mock_progress', JSON.stringify(progress))
      } catch { /* ignore corrupt data */ }
    }
  } catch {
    // Migration is best-effort
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const getUser = async () => {
      try {
        // Migrate old non-UUID mock user IDs before loading
        migrateOldMockUser()

        // Check localStorage for dev/mock user
        const mockUserStr = localStorage.getItem('csec_mock_user')
        if (mockUserStr) {
          const mockUser = JSON.parse(mockUserStr)
          setAuthState({ user: mockUser, loading: false, error: null })
          return
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const appUser = await fetchUserProfile(user.id)
          setAuthState({ user: appUser, loading: false, error: null })
        } else {
          setAuthState({ user: null, loading: false, error: null })
        }
      } catch (error) {
        setAuthState({ 
          user: null, 
          loading: false, 
          error: error instanceof Error ? error.message : 'Authentication error' 
        })
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Check for mock user first before overriding state
      const mockUserStr = localStorage.getItem('csec_mock_user')
      if (mockUserStr) {
        const mockUser = JSON.parse(mockUserStr)
        setAuthState({ user: mockUser, loading: false, error: null })
        return
      }
      
      if (session?.user) {
        const appUser = await fetchUserProfile(session.user.id)
        setAuthState({ user: appUser, loading: false, error: null })
      } else {
        setAuthState({ user: null, loading: false, error: null })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string): Promise<AppUser | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user profile:', error)
      return null
    }

    if (!data) {
      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        const newUser = {
          id: authData.user.id,
          email: authData.user.email!,
          name: authData.user.user_metadata?.name || authData.user.email!.split('@')[0],
        }
        
        const { data: createdUser } = await supabase
          .from('users')
          .insert(newUser)
          .select()
          .single()
        
        return createdUser
      }
    }

    return data
  }

  const signUp = async (email: string, password: string, name: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      // Mock user creation for testing — use a real UUID so Supabase storage works
      const mockUser = {
        id: crypto.randomUUID(),
        email,
        name,
      }
      
      localStorage.setItem('csec_mock_user', JSON.stringify(mockUser))
      setAuthState({ user: mockUser, loading: false, error: null })
      
      // Also try real Supabase signup
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name }
          }
        })

        if (!error && data.user) {
          const newUser = {
            id: data.user.id,
            email: data.user.email!,
            name,
          }
          
          try {
            await supabase.from('users').insert(newUser)
            setAuthState({ user: newUser, loading: false, error: null })
          } catch {
            // Supabase insert failed, but mock user is still set
            setAuthState({ user: mockUser, loading: false, error: null })
          }
        }
      } catch (supabaseError) {
        // Supabase signup failed, but mock user will work for testing
        console.log('Development mode: Using mock auth')
      }
    } catch (error) {
      setAuthState({ 
        user: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Sign up failed' 
      })
    }
  }

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      // For development/testing: accept any valid email/password
      if (email && password && password.length >= 6) {
        const mockUser = {
          id: crypto.randomUUID(),
          email,
          name: email.split('@')[0],
        }
        
        localStorage.setItem('csec_mock_user', JSON.stringify(mockUser))
        setAuthState({ user: mockUser, loading: false, error: null })
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      if (data.user) {
        const appUser = await fetchUserProfile(data.user.id)
        setAuthState({ user: appUser, loading: false, error: null })
      }
    } catch (error) {
      setAuthState({ 
        user: null, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Sign in failed' 
      })
    }
  }

  const signOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true }))
    
    try {
      localStorage.removeItem('csec_mock_user')
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setAuthState({ user: null, loading: false, error: null })
    } catch (error) {
      setAuthState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Sign out failed' 
      }))
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
    } catch (error) {
      setAuthState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Password reset failed' 
      }))
    }
  }

  return (
    <AuthContext.Provider value={{
      ...authState,
      signUp,
      signIn,
      signOut,
      resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}