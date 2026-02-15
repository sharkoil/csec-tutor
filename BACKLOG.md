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

### ✅ Task 13-16: Prompt Engineering Overhaul
- **Changes across all 3 prompts (STEM, Writing, General):**
  - Age: "14-year-old" → "14-16 year-old Caribbean secondary student (Form 4-5)"
  - Reading level: 9th-10th grade — clear and accessible but not childish
  - Section count: 12 → 10 (merged Learning Objectives + Why → "Why This Topic Matters & What You'll Learn"; merged Micro-Summary + Real-World → "Summary & Real-World Connections")
  - Paragraphs: "3-4 sentences max" → "2-3 sentences. Start each paragraph with the key point."
  - Scenario-first: "Open EVERY subtopic with a relatable Caribbean scenario, THEN define the concept. Never start with a dictionary definition."
  - Thoroughness: "This lesson may be the student's ONLY resource — they may not have a textbook. Be THOROUGH."
  - Subtopic depth: "Do NOT thin out subtopics. If a student reads only this lesson, they should fully understand every subtopic."
  - Word count: "3000-4000" → "3000-4500"
- **File:** `lib/ai-coach.ts`

### ✅ Task 19: Chat Helper with Responsible AI Guardrails
- **API:** `app/api/ai/chat/route.ts`
  - Scoped system prompt: only answers questions about the current subject/topic
  - Input sanitization: max 500 chars, HTML/markdown stripping, prompt injection detection (11 regex patterns)
  - Output filtering: catches model self-references that could leak prompt info
  - Rate limiting: 15 messages per 30-minute session (in-memory, per session ID)
  - Vector DB context: wraps in `<reference_material>` delimiters marked "read-only"
  - Lesson excerpt: passes current page content (truncated to 2000 chars) for context
  - Uses UTILITY model tier to control costs
  - Tracks usage via `ai_usage` table (fire-and-forget)
  - Graceful fallback on 402 (credits exhausted)
- **UI:** `components/lesson-chat.tsx`
  - Floating blue "Ask a Question" bubble (bottom-right, fixed position)
  - Expands into 360×500px chat panel with header, messages, input
  - Session-scoped: resets on page reload (no cross-session leakage)
  - Shows remaining question count when ≤3
  - Typing indicators (bouncing dots)
  - Keyboard support (Enter to send, Shift+Enter for newline)
  - Responsive: max-width adapts to viewport
- **Integration:** Added to `coaching/page.tsx` — only renders when lesson is loaded
- **Commit:** `78debdf`

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
| P4 (Prompt) | 4  | 4    | 0         |
| P5       | 2     | 0    | 2         |
| New      | 1     | 1    | 0         |
| **Total**| **21**| **16** | **5**  |
