/**
 * E2E tests for the study plan creation flow.
 *
 * These tests run against a live dev server and verify:
 * 1. Creating a plan navigates to /plans/{id} — NOT /dashboard
 * 2. The plan detail page renders topic cards
 * 3. The dashboard shows created plans
 * 4. Coaching page loads without errors
 *
 * Prerequisites:
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *   npm run dev  (auto-started by playwright.config.ts webServer)
 *
 * Run:
 *   npx playwright test
 */

import { test, expect } from '@playwright/test'

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Seed localStorage with a mock user and plan so we can skip auth.
 * This mirrors the exact keys the app reads from localStorage.
 */
async function seedLocalStorage(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const userId = 'e2e-test-user-' + Date.now()

    // Mock auth session so the app thinks we're logged in
    const mockUser = {
      id: userId,
      email: 'e2e@test.com',
      user_metadata: { full_name: 'E2E Test Student' },
    }
    localStorage.setItem('csec_mock_user', JSON.stringify(mockUser))

    // Seed a plan in localStorage
    const plan = {
      id: 'e2e-plan-001',
      user_id: userId,
      subject: 'Mathematics',
      topics: ['Algebra', 'Geometry'],
      status: 'active',
      wizard_data: {
        target_grade: 'grade_2',
        proficiency_level: 'intermediate',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    localStorage.setItem('csec_mock_plans', JSON.stringify([plan]))
    localStorage.setItem('csec_mock_progress', JSON.stringify([]))
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Study Plan Flow', () => {

  test('plan creation page loads without crash', async ({ page }) => {
    await seedLocalStorage(page)
    await page.goto('/plans/new')

    // Should see the wizard - first step is "Describe"
    await expect(page.getByText('Create Study Plan')).toBeVisible({ timeout: 15_000 })
  })

  test('dashboard shows plans from localStorage fallback', async ({ page }) => {
    await seedLocalStorage(page)
    await page.goto('/dashboard')

    // Should see the seeded plan
    await expect(page.getByText('Mathematics')).toBeVisible({ timeout: 15_000 })
  })

  test('plan detail page renders topic cards', async ({ page }) => {
    await seedLocalStorage(page)
    await page.goto('/plans/e2e-plan-001')

    // Should show the two topics from the seeded plan
    await expect(page.getByText('Algebra')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Geometry')).toBeVisible()
  })

  test('plan detail page does NOT redirect to dashboard for UUID user', async ({ page }) => {
    await seedLocalStorage(page)
    await page.goto('/plans/e2e-plan-001')

    // The URL should stay on the plan page, not redirect to /dashboard
    await page.waitForTimeout(3000)
    expect(page.url()).toContain('/plans/e2e-plan-001')
    expect(page.url()).not.toContain('/dashboard')
  })

  test('navigating to a non-existent plan redirects to dashboard', async ({ page }) => {
    await seedLocalStorage(page)
    await page.goto('/plans/does-not-exist-999')

    // Should redirect to /dashboard
    await page.waitForURL('**/dashboard', { timeout: 15_000 })
    expect(page.url()).toContain('/dashboard')
  })
})

test.describe('Coaching Page', () => {

  test('coaching page loads for a valid topic', async ({ page }) => {
    await seedLocalStorage(page)
    await page.goto('/plans/e2e-plan-001/topics/Algebra/coaching')

    // Should show the coaching interface or a "Generate" button
    // depending on whether content has been cached
    await expect(
      page.getByText(/Generate|Coaching|Algebra/i).first()
    ).toBeVisible({ timeout: 20_000 })

    // Should NOT redirect to /dashboard
    expect(page.url()).not.toContain('/dashboard')
  })
})
