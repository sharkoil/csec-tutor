# RIPLESSONS — Content UX Overhaul Backlog

> Tracking file for lesson content improvements.
> Created: 2026-02-14
> Last updated: 2026-02-14

---

## Completed

### ✅ BUG: Scroll-to-bottom on page advance
- **Priority:** P0 — BUG
- **Fix:** Added `useRef` on lesson container + `useEffect` watching `currentPage` that calls `scrollIntoView({ behavior: 'smooth', block: 'start' })`
- **File:** `app/plans/[id]/topics/[topic]/coaching/page.tsx`

### ✅ Task 1: Widen content container
- **Change:** `max-w-4xl` (896px) → `max-w-7xl` (1280px) on `<main>`
- **File:** `app/plans/[id]/topics/[topic]/coaching/page.tsx`

### ✅ Task 3: Remove Card wrapper from lesson content
- **Change:** Replaced `<Card>/<CardHeader>/<CardContent>` with clean `<div>` structure. Progress bar, pagination, and content are now direct children of `<main>`. Question cards and interactive elements retain their own borders/backgrounds.
- **File:** `app/plans/[id]/topics/[topic]/coaching/page.tsx`

### ✅ Task 4: Increase body font size to 18px
- **Change:** `.prose-lesson` font-size `0.95rem` → `1.125rem` (18px)
- **File:** `app/globals.css`

### ✅ Task 5: Increase heading hierarchy contrast
- **Change:** h1=36px extrabold, h2=28px extrabold + thicker border, h3=22px bold, h4=19px semibold
- **Files:** `app/globals.css` + inline heading classes in `coaching/page.tsx`

### ✅ Task 6: Set paragraph max-width to 70ch
- **Change:** Added `max-width: 70ch` to `.prose-lesson p` and `.prose-lesson ul/ol`
- **File:** `app/globals.css`

### ✅ Task 7: Responsive font sizing for mobile
- **Change:** Added `@media (max-width: 768px) { .prose-lesson { font-size: 1rem; } }`
- **File:** `app/globals.css`

### ✅ Task 8: Reduce words per page to 400-600
- **Change:** `paginateContent()` page target 1000→500 words, subsection target 800→400 words, overflow threshold 1200→600 words
- **File:** `app/plans/[id]/topics/[topic]/coaching/page.tsx`

### ✅ Task 9: Section spacing breathing room
- **Change:** h2 `mt-10 mb-4` → `mt-14 mb-6`, h3 `mt-8 mb-4` → `mt-10 mb-5`, h4 `mt-6 mb-3` → `mt-8 mb-4`, paragraph `mb-4` → `mb-5`, list `my-4 space-y-2` → `my-5 space-y-3`
- **Files:** `app/globals.css` + `coaching/page.tsx`

### ✅ Task 10: Sticky progress bar
- **Change:** Progress bar is now `sticky top-0 z-10` with `backdrop-blur-sm bg-gray-50/95`. Shows "Part X of Y" center label. Stays visible while scrolling.
- **File:** `app/plans/[id]/topics/[topic]/coaching/page.tsx`

---

## Remaining — Not Started

### Task 2: Two-column layout on desktop (P0)
- Add sticky sidebar at `lg:` breakpoint (~35% width) with:
  - Lesson outline (auto-generated from h2/h3 headings)
  - Progress indicator
  - Key terms glossary
- Collapse to accordion on mobile
- **Effort:** 2-3 hours

### Task 11: Make quiz questions interactive (P3)
- Add `onClick` handlers to MCQ options
- Track selected answer in state
- Show green/red feedback with explanation
- POST to `/api/metrics` type `quiz` → populate `quiz_results`
- **Effort:** 2-3 hours

### Task 12: "Key Takeaway" summary cards (P3)
- Instruct AI prompt to insert `> 📌 **Key Takeaway:** ...` after every 2-3 paragraphs
- Render as highlighted summary card
- **Effort:** 1 hour

### Task 13: Shorten paragraphs to 2-3 sentences (P4 — Prompt)
- Add to system prompt: "Keep every paragraph to 2-3 sentences maximum."
- **Effort:** 5 min

### Task 14: Lead with Caribbean examples (P4 — Prompt)
- Add to prompt: "Open each subtopic with a relatable Caribbean scenario, not a definition."
- **Effort:** 5 min

### Task 15: Reduce section count 12→7-8 (P4 — Prompt)
- Merge Learning Objectives + Why This Topic Matters
- Merge Micro-Summary + Real-World Application
- **Effort:** 30 min

### Task 16: Target 6th-8th grade reading level (P4 — Prompt)
- Add reading level instruction to AI prompt
- **Effort:** 5 min

### Task 17: Segmented progress bar with section titles (P5)
- Replace simple bar with labeled segments, clickable to jump
- **Effort:** 1-2 hours

### Task 18: Scroll-triggered fade-in animations (P5)
- Add `IntersectionObserver` for subtle content fade-in
- **Effort:** 1 hour

---

## Summary

| Priority | Total | Done | Remaining |
|----------|-------|------|-----------|
| BUG      | 1     | 1    | 0         |
| P0       | 3     | 2    | 1         |
| P1       | 4     | 4    | 0         |
| P2       | 3     | 3    | 0         |
| P3       | 3     | 1    | 2         |
| P4       | 4     | 0    | 4         |
| P5       | 2     | 0    | 2         |
| **Total**| **20**| **11** | **9**  |
