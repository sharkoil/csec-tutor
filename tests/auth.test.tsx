import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

// Mock Supabase
jest.mock('../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getUser: jest.fn(),
        onAuthStateChange: jest.fn()
      },
      from: jest.fn().mockReturnThis()
    }
  }
})

describe('Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('AuthProvider', () => {
    it('should provide auth context to children', () => {
      const TestComponent = () => {
        const { user } = useAuth()
        return <div data-testid="user">{user?.name || 'No user'}</div>
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('user')).toBeInTheDocument()
    })

    it('should handle loading state', async () => {
      // Mock loading state
      jest.doMock('../lib/auth', () => ({
        AuthProvider: jest.fn().mockImplementation(({ children }) => {
          const [state, setState] = React.useState({ user: null, loading: true, error: null })
          
          React.useEffect = jest.fn().mockImplementation((fn) => {
            return fn(() => {
              setState({ user: { id: '1', name: 'Test User' }, loading: false, error: null })
            })
          })
          
          return React.createElement('div', null, children)
        })
      }))

      const TestComponent = () => {
        const { user, loading } = useAuth()
        return (
          <div>
            <div data-testid="loading">{loading ? 'Loading...' : 'Loaded'}</div>
            <div data-testid="user">{user?.name || 'No user'}</div>
          </div>
        )
      }

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('loading')).toHaveTextContent('Loading...')
    })
  })

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      const TestComponent = () => {
        useAuth()
        return <div>Test</div>
      }

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useAuth must be used within an AuthProvider')
    })
  })
})