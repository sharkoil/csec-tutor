# Quick Summary: Mobile vs Desktop Issue

## TL;DR

**Issue**: Different lesson plans shown on mobile vs desktop  
**Root Cause**: Random UUID generated on each login  
**Status**: By design (development mode), not a bug  
**Severity**: High impact if users expect cross-device access  

## The Problem in 30 Seconds

```
Desktop Login  → UUID: aaaa-aaaa → Save plan with user_id=aaaa-aaaa ✓
Mobile Login   → UUID: bbbb-bbbb → Query plan with user_id=bbbb-bbbb ✗ (not found)
```

Same email, different UUID = can't find the study plans.

## Why This Happens

**In `lib/auth.tsx` (lines 164-226):**
```typescript
const signUp = async (email: string, password: string, name: string) => {
  const mockUser = {
    id: crypto.randomUUID(),  // ← NEW RANDOM UUID EVERY TIME
    email,
    name,
  }
  localStorage.setItem('csec_mock_user', JSON.stringify(mockUser))
}
```

Each login creates a brand new user identity, even with the same email.

## Impact

| What | Impact | Why |
|------|--------|-----|
| Cross-device access | ❌ Broken | Each device has different UUID |
| Re-login on same device | ❌ Broken | New UUID generated each time |
| localStorage data | ⚠️ Isolated | Browser-specific storage |
| Lesson caching | 💰 Wasteful | Regenerates for each UUID |
| Data loss | 🔴 HIGH | Old plans become inaccessible |

## Quick Fix Options

### Option 1: Deterministic UUID (Recommended)
Hash the email to always get the same UUID:
```typescript
import { createHash } from 'crypto'

function uuidFromEmail(email: string): string {
  const hash = createHash('sha256').update(email).digest('hex')
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`
}
```

**Pros**: ✅ Minimal change, ✅ Works immediately  
**Cons**: ⚠️ Requires user migration

### Option 2: Enable Real Supabase Auth
Remove mock auth entirely, use proper authentication.

**Pros**: ✅ Production-ready, ✅ Built-in cross-device  
**Cons**: ⚠️ Requires Supabase setup

## Files Involved

- ⚠️ `lib/auth.tsx` - UUID generation (root cause)
- ⚠️ `lib/plan-storage.ts` - Plan fetching by user_id
- ⚠️ `app/api/ai/coaching/route.ts` - Lesson caching by user_id
- ℹ️ `app/dashboard/page.tsx` - Where issue is visible

## Testing the Issue

1. **Desktop**: Sign up with `test@example.com`, create a study plan
2. **Mobile**: Sign in with `test@example.com`
3. **Expected**: See the study plan
4. **Actual**: No study plans found ❌

## Is This a Bug?

**No**, it's working as designed for development/testing mode.

The mock authentication is intentionally simple and doesn't persist identity across sessions. This is acceptable for local development but problematic if users expect real authentication behavior.

## Recommendation

If this app is intended for production use with multiple devices:
1. Implement deterministic UUID generation from email
2. OR enable real Supabase authentication
3. Migrate existing users to new UUID scheme

If this is only for local development:
1. Document the limitation clearly
2. Add warning message about cross-device access
3. Keep current behavior

## Full Details

See:
- `INVESTIGATION_MOBILE_VS_DESKTOP.md` - Complete technical analysis (15KB)
- `INVESTIGATION_FLOW_DIAGRAM.md` - Visual flow diagrams (17KB)

---

**Investigation completed**: 2026-02-16  
**No code changes made** (investigation only)
