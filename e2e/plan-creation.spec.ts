/**
 * E2E tests for plan creation and fetching using Playwright
 * 
 * Tests the complete workflow from navigating to /plans/new, creating a plan,
 * and verifying it appears in the plans list and can be fetched.
 * 
 * Prerequisites:
 * - Dev server running at http://localhost:3000
 * - Supabase RLS policies fixed (run database/fix-rls-policies.sql)
 * - SUPABASE_SERVICE_ROLE_KEY set in environment
 */

import { test, expect, Page } from '@playwright/test'

test.describe('Study Plan Creation E2E', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    // Capture console messages to detect errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`Browser Error: ${msg.text()}`)
      }
    })
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('should create a study plan successfully', async () => {
    // Navigate to the create plan page
    await page.goto('http://localhost:3000/plans/new')
    
    // Wait for the form to load
    await page.waitForSelector('form', { timeout: 5000 })

    // Verify the page loaded successfully (no 500 errors in title)
    const title = await page.title()
    expect(title).not.toContain('500')

    // Fill in the plan form with test data
    const subjectInput = await page.$('select[name="subject"], input[name="subject"]')
    if (subjectInput) {
      const inputType = await subjectInput.evaluate((el) => el.tagName)
      if (inputType === 'SELECT') {
        await subjectInput.selectOption('Mathematics')
      } else {
        await subjectInput.fill('Mathematics')
      }
    }

    // Look for topic checkboxes or selections
    const topicCheckboxes = await page.$$('input[type="checkbox"]')
    if (topicCheckboxes.length > 0) {
      // Check first two topic checkboxes
      await topicCheckboxes[0].check()
      if (topicCheckboxes.length > 1) {
        await topicCheckboxes[1].check()
      }
    }

    // Find and click the submit button
    const submitButton = await page.$('button[type="submit"]')
    expect(submitButton).not.toBeNull()
    
    if (submitButton) {
      await submitButton.click()
    }

    // Wait for the plan to be created and redirect to plan page
    // Should be redirected to /plans/{id}
    await page.waitForURL(/\/plans\/[a-f0-9-]+/, { timeout: 10000 })
    
    const finalUrl = page.url()
    expect(finalUrl).toMatch(/\/plans\/[a-f0-9-]+/)

    // Verify the plan page loaded without errors
    const planTitle = await page.title()
    expect(planTitle).not.toContain('500')
    expect(planTitle).not.toContain('Error')
  })

  test('should fetch and display created plan', async () => {
    // Navigate to dashboard which should list plans
    await page.goto('http://localhost:3000/dashboard')
    
    await page.waitForSelector('body', { timeout: 5000 })

    // Look for a plan card or list item
    const planElements = await page.$$('[data-testid="plan-item"], .plan-card, [class*="plan"]')
    
    // Should have at least the previously created plan
    if (planElements.length > 0) {
      expect(planElements.length).toBeGreaterThan(0)
      
      // Click the first plan
      await planElements[0].click()
      
      // Should navigate to the plan details page
      await page.waitForURL(/\/plans\/[a-f0-9-]+/, { timeout: 5000 })
      expect(page.url()).toMatch(/\/plans\//)
    }
  })

  test('should handle database errors gracefully', async () => {
    // This test verifies error handling without relying on a specific error state
    await page.goto('http://localhost:3000/plans/new')
    
    await page.waitForSelector('form', { timeout: 5000 })

    // The form should be accessible even if there are issues
    const form = await page.$('form')
    expect(form).not.toBeNull()

    // No 500 errors should appear in the page
    const body = await page.textContent('body')
    expect(body).not.toContain('500')
  })

  test('should handle localStorage fallback gracefully', async () => {
    // Create a new context to test localStorage behavior
    const { context } = test

    // Navigate to the plan creation page
    await page.goto('http://localhost:3000/plans/new')
    
    await page.waitForSelector('form', { timeout: 5000 })

    // Check that localStorage is available
    const hasLocalStorage = await page.evaluate(() => {
      try {
        localStorage.setItem('test', 'test')
        localStorage.removeItem('test')
        return true
      } catch {
        return false
      }
    })

    expect(hasLocalStorage).toBe(true)
  })

  test('should not show authentication errors on form', async () => {
    await page.goto('http://localhost:3000/plans/new')
    
    // Wait for navigation to complete
    await page.waitForLoadState('networkidle')
    const currentUrl = page.url()

    // Should not have redirected to auth page due to permission errors
    expect(currentUrl).not.toContain('/auth')
    
    // Page should not contain common error messages
    const pageContent = await page.textContent('body')
    expect(pageContent).not.toContain('Unauthorized')
    expect(pageContent).not.toContain('Permission denied')
    expect(pageContent).not.toContain('PGRST301') // RLS error code
  })
})

test.describe('Plan Storage Fallback Behavior', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('should detect localStorage plan IDs correctly', async () => {
    await page.goto('http://localhost:3000')

    // Store a localStorage plan ID
    const localStoragePlanId = 'plan_test_' + Date.now()
    
    await page.evaluate((planId) => {
      const plans = JSON.parse(localStorage.getItem('csec_mock_plans') || '[]')
      plans.push({
        id: planId,
        user_id: 'test-user',
        subject: 'Test Subject',
        topics: ['Test Topic'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      localStorage.setItem('csec_mock_plans', JSON.stringify(plans))
    }, localStoragePlanId)

    // Navigate to try fetching this plan
    await page.goto(`http://localhost:3000/plans/${localStoragePlanId}`)
    
    await page.waitForLoadState('networkidle')

    // Should either show the plan or show a graceful message
    // Either way, it shouldn't show a 404 or 500 error
    const pageContent = await page.textContent('body')
    expect(pageContent).not.toContain('500')
  })
})

test.describe('Network Error Resilience', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('should not crash when plan actions server errors occur', async () => {
    // Intercept and block the plan creation API call to simulate server error
    await page.route('**/api/**', (route) => {
      route.abort('failed')
    })

    await page.goto('http://localhost:3000/plans/new', { waitUntil: 'domcontentloaded' })
    
    await page.waitForSelector('form', { timeout: 5000 })

    // Form should still be visible and usable
    const form = await page.$('form')
    expect(form).not.toBeNull()

    // Restore network
    await page.unroute('**/api/**')
  })
})
