# Investigation Report: Mobile vs Desktop Lesson Plan Discrepancy

**Date**: 2026-02-16  
**Issue**: User reports seeing different lesson plans when logging in from mobile vs desktop  
**Suspected Cause**: Caching or rendering issue

---

## Executive Summary

After thorough investigation of the codebase, I have identified **two primary root causes** for users seeing different lesson plans between mobile and desktop:

1. **Browser-Specific localStorage Isolation** - Study plans are stored in localStorage with UUID-based user IDs
2. **Session-Based UUID Generation** - Mock authentication generates a new UUID on each login

### Impact
- **HIGH**: Users cannot access their study plans across devices
- **HIGH**: Users lose progress when switching devices
- **MEDIUM**: Users may lose their plans if they clear browser data

---

## Technical Root Cause Analysis

### 1. Authentication System Design

The authentication system (`lib/auth.tsx`) uses a **mock authentication fallback** that generates new UUIDs:

```typescript
// Line 164-171 in lib/auth.tsx
const signUp = async (email: string, password: string, name: string) => {
  const mockUser = {
    id: crypto.randomUUID(),  // ⚠️ NEW UUID GENERATED EACH TIME
    email,
    name,
  }
  localStorage.setItem('csec_mock_user', JSON.stringify(mockUser))
}

// Line 211-226 in lib/auth.tsx  
const signIn = async (email: string, password: string) => {
  if (email && password && password.length >= 6) {
    const mockUser = {
      id: crypto.randomUUID(),  // ⚠️ NEW UUID GENERATED EACH TIME
      email,
      name: email.split('@')[0],
    }
    localStorage.setItem('csec_mock_user', JSON.stringify(mockUser))
  }
}
```

**Key Issues:**
- Each login generates a **new random UUID**
- The UUID is not deterministic based on the email address
- Each device/browser gets a completely different user ID
- Even on the same device, signing out and signing back in creates a new user

### 2. Study Plan Storage Architecture

Study plans are stored with a **dual-backend strategy** (`lib/plan-storage.ts`):

```typescript
// Line 66-91 in lib/plan-storage.ts
export async function savePlan(planData: Omit<StudyPlan, 'id'>): Promise<StudyPlan> {
  try {
    // Try Supabase first
    const { savePlanAction } = await import('@/lib/plan-actions')
    const result = await savePlanAction(planData)
    if (result) {
      return result  // Stored in Supabase with UUID
    }
  } catch (err) {
    console.warn('[plan-storage] Server action failed, falling back to localStorage:', err)
  }

  // Fallback: localStorage with generated plan ID
  const localId = generateLocalId()  // Generates "plan_xxxxx"
  const localPlan: StudyPlan = { id: localId, ...planData } as StudyPlan
  const existing = getLocalPlans()
  existing.push(localPlan)
  setLocalPlans(existing)
  return localPlan
}
```

**Key Issues:**
- Plans are keyed by `user_id` (the randomly generated UUID)
- localStorage is **browser-specific** and cannot sync across devices
- Even if Supabase is working, the mock auth generates different user IDs

### 3. Lesson Caching Mechanism

Lessons are cached in Supabase with user-specific personalization (`app/api/ai/coaching/route.ts`):

```typescript
// Lines 153-157 in app/api/ai/coaching/route.ts
const validUserId = userId && isValidUUID(userId) ? userId : null
const scope: CacheScope = validUserId
  ? { contentType: 'personalized', userId: validUserId }  // ⚠️ User-specific cache
  : { contentType: 'common', userId: null }

// Lines 63-71 in app/api/ai/coaching/route.ts
if (scope.contentType === 'personalized' && scope.userId) {
  query = query.eq('user_id', scope.userId)  // ⚠️ Cache is isolated per user_id
}
```

**Key Issues:**
- Personalized lessons are cached per `user_id`
- Each device has a different UUID, so caches don't match
- Users see "no cached lesson" and trigger regeneration on different devices

---

## Evidence & Reproduction Steps

### How to Reproduce the Issue

1. **On Desktop:**
   - Open the app in Chrome
   - Sign up with email: `test@example.com`
   - Create a study plan for "Mathematics" with topics: "Algebra", "Geometry"
   - Complete the Algebra coaching lesson
   - Note: localStorage will contain user with UUID `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

2. **On Mobile (or Different Browser):**
   - Open the same app in Safari/Mobile Chrome
   - Sign in with the same email: `test@example.com`
   - **Result**: Study plans are missing! A new UUID was generated: `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy`

3. **Even on Same Device:**
   - Sign out from the desktop browser
   - Sign back in with the same credentials
   - **Result**: New UUID generated, previous plans are inaccessible

### Evidence from Code

**Plan Fetching (lib/plan-storage.ts:97-112):**
```typescript
export async function fetchPlans(userId: string): Promise<StudyPlan[]> {
  try {
    const { fetchPlansAction } = await import('@/lib/plan-actions')
    const dbPlans = await fetchPlansAction(userId)  // ⚠️ Queries by userId
    if (dbPlans.length > 0) {
      return dbPlans
    }
  } catch (err) {
    console.warn('[plan-storage] Server action failed, using localStorage:', err)
  }

  const local = getLocalPlans()  // ⚠️ Returns ALL plans from localStorage
  return local  // ⚠️ Not filtered by userId!
}
```

**Note**: Even the localStorage fallback returns ALL plans without filtering by `user_id`, but since each browser has its own localStorage, this still results in isolation.

---

## Impact Analysis

### Functional Impact

| Impact Area | Severity | Description |
|------------|----------|-------------|
| **Cross-Device Access** | 🔴 HIGH | Users cannot access their study plans on different devices |
| **Progress Loss** | 🔴 HIGH | Switching devices means starting from scratch |
| **Data Integrity** | 🟡 MEDIUM | Multiple "accounts" can be created with the same email |
| **User Experience** | 🔴 HIGH | Confusing behavior - users expect their data to follow them |
| **Cost Efficiency** | 🟡 MEDIUM | Duplicate lesson generation wastes AI credits |

### Security & Privacy Impact

| Impact Area | Severity | Description |
|------------|----------|-------------|
| **Account Isolation** | ✅ LOW | Actually beneficial - each session is isolated |
| **Data Leakage** | ✅ NONE | No risk of seeing other users' data |
| **Authentication Security** | 🟡 MEDIUM | Mock auth is only for dev/testing |

---

## Architectural Design Observations

### Why This Design Exists

Based on the code comments and structure, this appears to be **intentional for development/testing**:

```typescript
// lib/auth.tsx:196-201
} catch (supabaseError) {
  // Supabase signup failed, but mock user will work for testing
  console.log('Development mode: Using mock auth')
}

// lib/auth.tsx:213-217
// For development/testing: accept any valid email/password
if (email && password && password.length >= 6) {
  // ... generate mock user
}
```

### Migration Support

The codebase includes **migration logic** to handle legacy non-UUID user IDs:

```typescript
// lib/auth.tsx:26-64
function migrateOldMockUser(): void {
  try {
    const mockUserStr = localStorage.getItem('csec_mock_user')
    if (!mockUserStr) return

    const mockUser = JSON.parse(mockUserStr)
    if (!mockUser.id || isValidUUID(mockUser.id)) return // already good

    const oldId = mockUser.id
    const newId = crypto.randomUUID()
    console.log(`[auth] Migrating mock user ID from ${oldId} to ${newId}`)
    // ... migrate plans and progress
  } catch { /* ignore corrupt data */ }
}
```

This suggests the team is aware of ID format issues and has built migration tooling.

---

## Why Users See Different Lesson Plans

### Scenario Breakdown

#### Scenario 1: User has Supabase Working
1. **Desktop Login**: UUID `aaaa-aaaa` generated
2. Study plan saved to Supabase with `user_id = aaaa-aaaa`
3. Lessons cached with `user_id = aaaa-aaaa`
4. **Mobile Login**: UUID `bbbb-bbbb` generated
5. Query Supabase for plans with `user_id = bbbb-bbbb` → **returns empty**
6. User sees no study plans

#### Scenario 2: User has Supabase Failing (localStorage Fallback)
1. **Desktop Browser**: UUID `aaaa-aaaa` generated
2. Study plan saved to desktop's localStorage
3. **Mobile Browser**: UUID `bbbb-bbbb` generated
4. Query mobile's localStorage → **completely separate storage**
5. User sees no study plans

#### Scenario 3: Mixed Storage States
1. **Desktop**: Supabase working, plans saved to DB
2. **Mobile**: Supabase fails, falls back to localStorage
3. Plans are in **completely different storage backends**
4. Even if UUIDs matched, data wouldn't sync

---

## Caching Behavior Analysis

### Lesson Cache Isolation

The coaching API uses a sophisticated caching system with versioning:

```typescript
// lib/lesson-cache.ts:16
export const LESSON_PROMPT_VERSION = 'v2-12-section'

// lib/lesson-cache.ts:39-44
export function serializeCachedContent(content: string, wizardData?: WizardData): string {
  const metadata = {
    v: LESSON_PROMPT_VERSION,
    w: buildWizardSignature(wizardData),  // Wizard profile signature
  }
  return `<!-- LESSON_CACHE_META:${JSON.stringify(metadata)} -->\n${content}`
}
```

**Cache Invalidation Triggers:**
1. Prompt version changes (LESSON_PROMPT_VERSION)
2. Wizard data profile changes (learning style, proficiency, etc.)
3. **User ID changes** (different users get separate caches)

Since each device has a different UUID, lesson caches are **never shared** between devices.

---

## Recommendations

### Option 1: Deterministic UUID Generation (Quick Fix)
Generate UUIDs deterministically from the email address:

```typescript
// Example implementation
import { createHash } from 'crypto'

function generateDeterministicUUID(email: string): string {
  const hash = createHash('sha256').update(email).digest('hex')
  // Format as UUID v4
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`
}
```

**Pros:**
- ✅ Same email = same UUID across devices
- ✅ Minimal code changes
- ✅ Works with existing dual-backend storage

**Cons:**
- ⚠️ Not cryptographically secure (but acceptable for mock auth)
- ⚠️ All existing users would need migration
- ⚠️ Multiple signups with same email create same UUID

### Option 2: Persist Mock User UUID (Medium Fix)
Store the mock user UUID somewhere that persists:

```typescript
// Store in Supabase table on first signup
// Retrieve on subsequent logins
```

**Pros:**
- ✅ True persistence across devices
- ✅ Proper user identity management

**Cons:**
- ⚠️ Requires Supabase to be working
- ⚠️ More complex migration
- ⚠️ Defeats the purpose of "mock" auth

### Option 3: Enable Real Supabase Auth (Proper Fix)
Remove the mock authentication layer entirely and require real Supabase auth:

**Pros:**
- ✅ Production-ready authentication
- ✅ Built-in cross-device support
- ✅ Proper security

**Cons:**
- ⚠️ Requires Supabase configuration
- ⚠️ No offline development mode
- ⚠️ Users must verify emails

### Option 4: localStorage Sync Mechanism (Complex)
Implement a localStorage sync layer that pushes/pulls from Supabase:

**Pros:**
- ✅ Works offline
- ✅ Syncs when online

**Cons:**
- ⚠️ Complex conflict resolution
- ⚠️ Significant development effort
- ⚠️ Still doesn't solve the UUID problem

---

## Additional Findings

### localStorage Keys Used
```typescript
// lib/plan-storage.ts
const PLANS_KEY = 'csec_mock_plans'           // Study plans array
const PROGRESS_KEY = 'csec_mock_progress'     // Progress map

// lib/auth.tsx  
'csec_mock_user'  // User profile with UUID
```

### Supabase Tables
```
- users (id, email, name)
- study_plans (id, user_id, subject, topics, status, wizard_data, ...)
- progress (id, user_id, plan_id, topic, coaching_completed, ...)
- lessons (subject, topic, content, content_type, user_id, model, ...)
```

### Wizard Data Personalization
Study plans can include `wizard_data` with learning preferences:
- `target_grade` - Desired grade level
- `proficiency_level` - Current skill level
- `topic_confidence` - Confidence per topic
- `learning_style` - Preferred learning approach

This is factored into lesson cache keys, meaning personalized lessons won't match across users even with the same topic.

---

## Browser Compatibility Notes

### localStorage Behavior
- **Desktop Chrome**: Persistent until cleared
- **Mobile Chrome**: Same origin, separate storage
- **Safari**: May be cleared more aggressively (7-day limit for non-visited sites)
- **Private/Incognito**: Cleared on session end

### UUID Generation
- `crypto.randomUUID()` is supported in modern browsers
- No polyfill detected in codebase
- Requires secure context (HTTPS or localhost)

---

## Testing Recommendations

If this behavior is unintended, here are testing scenarios:

1. **Cross-Device Persistence Test**
   - Create study plan on Device A
   - Login with same email on Device B
   - Verify study plan appears

2. **Re-Login Test**
   - Create study plan
   - Sign out
   - Sign in with same credentials
   - Verify study plan persists

3. **Supabase Fallback Test**
   - Disable Supabase credentials
   - Create study plan (should use localStorage)
   - Re-enable Supabase
   - Verify plan remains accessible

4. **Cache Sharing Test**
   - Generate lesson on Device A
   - Login on Device B
   - Verify cached lesson loads (doesn't regenerate)

---

## Conclusion

The reported issue of seeing different lesson plans between mobile and desktop is **by design** due to the mock authentication system generating new UUIDs on each login. This is likely acceptable for development/testing but would be problematic in production.

**Key Takeaways:**
1. ✅ **Not a bug** in the traditional sense - system is working as coded
2. ⚠️ **Design limitation** - mock auth isn't suitable for cross-device use
3. 🔧 **Fixable** with deterministic UUID generation or proper Supabase auth
4. 📊 **Impact is high** if users expect cross-device access

The caching system itself is well-designed with proper versioning and personalization. The root cause is purely in the authentication layer.

---

## Related Files

### Core Files
- `lib/auth.tsx` - Authentication with UUID generation
- `lib/plan-storage.ts` - Dual-backend storage strategy
- `lib/plan-actions.ts` - Server actions for Supabase
- `lib/lesson-cache.ts` - Lesson caching with versioning

### API Routes  
- `app/api/ai/coaching/route.ts` - Lesson generation and caching

### Components
- `app/dashboard/page.tsx` - Dashboard displaying study plans
- `components/auth-form.tsx` - Sign in/sign up UI

### Tests
- `tests/plan-storage.test.ts` - Storage fallback tests
- `tests/lesson-cache.test.ts` - Cache versioning tests
- `tests/auth.test.tsx` - Authentication tests

---

**Report Compiled By**: GitHub Copilot Agent  
**Investigation Type**: Code Analysis (No Changes Made)  
**Next Steps**: Present findings to development team for decision on approach
