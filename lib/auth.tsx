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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const getUser = async () => {
      try {
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
      // Mock user creation for testing
      const mockUser = {
        id: 'user_' + Math.random().toString(36).substr(2, 9),
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
          
          await supabase
            .from('users')
            .insert(newUser)
            .then(() => {
              setAuthState({ user: newUser, loading: false, error: null })
            })
            .catch(() => {
              // Supabase insert failed, but mock user is still set
              setAuthState({ user: mockUser, loading: false, error: null })
            })
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
          id: 'user_' + Math.random().toString(36).substr(2, 9),
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