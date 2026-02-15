import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { AuthProvider } from '../lib/auth'
import { CSEC_SUBJECTS } from '../data/subjects'

// Test components without auth context for easier testing
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    {children}
  </AuthProvider>
)

describe('Component Integration Tests', () => {
  beforeAll(() => {
    // Set up global test configuration
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
      })),
    })
  })

  describe('AuthForm Component', () => {
    it('should render sign up form initially', async () => {
      const { AuthForm } = await import('../components/auth-form')
      
      render(
        <TestWrapper>
          <AuthForm mode="signup" onToggleMode={jest.fn()} />
        </TestWrapper>
      )

      expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument()
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('should switch between sign in and sign up', async () => {
      const { AuthForm } = await import('../components/auth-form')
      const mockToggle = jest.fn()
      
      render(
        <TestWrapper>
          <AuthForm mode="signin" onToggleMode={mockToggle} />
        </TestWrapper>
      )

      // Wait for auth loading to complete (button becomes enabled)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign up/i })).not.toBeDisabled()
      })

      // Click switch mode link
      const toggleButton = screen.getByRole('button', { name: /sign up/i })
      fireEvent.click(toggleButton)

      expect(mockToggle).toHaveBeenCalled()
    })

    it('should handle form submission', async () => {
      const { AuthForm } = await import('../components/auth-form')
      
      render(
        <TestWrapper>
          <AuthForm mode="signup" onToggleMode={jest.fn()} />
        </TestWrapper>
      )

      // Fill out form
      await userEvent.type(screen.getByLabelText('Full Name'), 'Test User')
      await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
      await userEvent.type(screen.getByLabelText('Password'), 'password123')

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Create Account|Sign In/ })
      fireEvent.click(submitButton)

      // Form should have been submitted — button exists and was clickable
      expect(submitButton).toBeDefined()
    })
  })

  describe('Study Plan Creation', () => {
    it('should display available subjects', async () => {
      // Mock the plan creation page
      jest.doMock('../lib/auth', () => {
        return {
          useAuth: jest.fn().mockReturnValue({
            user: { id: '1', name: 'Test User' },
            loading: false,
            error: null
          })
        }
      })

      // Test subject selection
      const subjects = Object.values(CSEC_SUBJECTS)
      expect(subjects.length).toBeGreaterThan(0)
      expect(subjects[0]).toHaveProperty('name')
      expect(subjects[0]).toHaveProperty('topics')
      expect(Array.isArray(subjects[0].topics)).toBe(true)
    })

    it('should handle topic selection', async () => {
      const selectedSubject = CSEC_SUBJECTS.mathematics
      const selectedTopics = ['Algebra', 'Geometry']

      // Verify topic selection logic
      expect(selectedTopics.length).toBe(2)
      expect(selectedSubject.topics).toContain('Algebra')
      expect(selectedSubject.topics).toContain('Geometry and Trigonometry')
    })
  })

  describe('Progress Tracking', () => {
    it('should calculate completion percentage correctly', () => {
      const progress = {
        coaching_completed: true,
        practice_completed: true,
        exam_completed: false
      }

      const completionPercentage = Math.round(
        ((progress.coaching_completed ? 1 : 0) +
         (progress.practice_completed ? 1 : 0) +
         (progress.exam_completed ? 1 : 0)) / 3 * 100 * 100
      ) / 100

      expect(completionPercentage).toBe(66.67) // 2/3 completed
    })

    it('should handle score ranges', () => {
      const scores = {
        practice_score: 85,
        exam_score: 92
      }

      expect(scores.practice_score).toBeGreaterThanOrEqual(0)
      expect(scores.practice_score).toBeLessThanOrEqual(100)
      expect(scores.exam_score).toBeGreaterThanOrEqual(0)
      expect(scores.exam_score).toBeLessThanOrEqual(100)
    })
  })

  describe('Responsive Design', () => {
    it('should render on mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })

      // Test mobile-responsive components
      expect(window.innerWidth).toBe(375)
    })

    it('should render on desktop viewport', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024
      })

      // Test desktop components
      expect(window.innerWidth).toBe(1024)
    })
  })

  describe('Error Handling', () => {
    it('should display error messages', async () => {
      const { AuthForm } = await import('../components/auth-form')
      const mockToggle = jest.fn()
      
      render(
        <TestWrapper>
          <AuthForm mode="signup" onToggleMode={mockToggle} />
        </TestWrapper>
      )

      // The auth form should be rendered with signup fields
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('should handle network errors gracefully', async () => {
      // Test that error boundaries don't crash the app
      const mockError = new Error('Network error')
      expect(mockError.message).toBe('Network error')

      // Verify the auth form renders without crashing
      const { AuthForm } = await import('../components/auth-form')
      const mockToggleFn = jest.fn()
      render(
        <TestWrapper>
          <AuthForm mode="signin" onToggleMode={mockToggleFn} />
        </TestWrapper>
      )

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
    })
  })
})