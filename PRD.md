# Product Requirements Document — RIPLESSONS v2

**Document Version:** 1.1  
**Date:** February 2026  
**Author:** Engineering  
**Status:** Draft — For Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Market Context](#2-product-vision--market-context)
3. [Current State Assessment](#3-current-state-assessment)
4. [Architecture Overview](#4-architecture-overview)
5. [LLM Cost Optimization Strategy](#5-llm-cost-optimization-strategy)
6. [Content Ingestion & Vector Database](#6-content-ingestion--vector-database)
7. [System Design](#7-system-design)
8. [Data Model](#8-data-model)
9. [API Design](#9-api-design)
10. [Feature Specifications](#10-feature-specifications)
11. [Performance & Scalability](#11-performance--scalability)
12. [Security & Authentication](#12-security--authentication)
13. [Infrastructure & Deployment](#13-infrastructure--deployment)
14. [Phased Rollout Plan](#14-phased-rollout-plan)
15. [Success Metrics & KPIs](#15-success-metrics--kpis)
16. [Cost Projections](#16-cost-projections)
17. [Risk Assessment](#17-risk-assessment)
18. [Appendices](#18-appendices)

---

## 1. Executive Summary

RIPLESSONS is an AI-powered tutoring platform for Caribbean Secondary Education Certificate (CSEC) students aged 14–16. It generates personalized, textbook-quality lesson content, interactive quizzes, practice exams, and adaptive study schedules across 6 CSEC subjects (Mathematics, English A, Biology, Chemistry, Physics, Principles of Business) totalling 70+ topics.

### The Problem with v1

The current prototype (v1) was built iteratively to validate demand. It works, but has **critical architectural debt** that makes it unscalable and unnecessarily expensive:

| Issue | Impact |
|-------|--------|
| Every lesson generation burns **13,000–15,000 tokens** on GPT-5.2, including a ~5,000-token system prompt repeated verbatim on each call | Estimated $0.15–$0.30/lesson at current pricing |
| Practice questions and exams use GPT-5.2 (flagship model) for tasks that GPT-3.5/4o-mini could handle | 10–50× cost premium for equivalent quality |
| 3 competing content generation paths with inconsistent caching | Lessons sometimes regenerated unnecessarily |
| No authentication on AI API routes | Anyone with the URL can drain credits |
| 1,895-line monolithic coaching page component | Unmaintainable; full re-render on any interaction |
| Mock auth creates orphaned user records | Data integrity issues |
| No job queue for long-running AI generations | Serverless timeouts on Vercel (30s free tier) |

### v2 Goals

1. **Cut LLM costs by 60–80%** through intelligent model routing, prompt compression, and aggressive caching
2. **Scale to 10,000 concurrent students** without architecture changes
3. **Sub-2-second time-to-first-byte** on cached lessons
4. **Production-grade auth, security, and observability** for investor-readiness
5. **Modular, testable codebase** that a small team (2–4 engineers) can iterate on rapidly

---

## 2. Product Vision & Market Context

### Target Users

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| **Student (primary)** | 14–16 year-old in Form 4–5 preparing for CSEC exams | Age-appropriate content, scenario-based learning, mobile-friendly, affordable |
| **Parent** | Guardian monitoring child's progress | Dashboard with streak/grade data, cost transparency |
| **Teacher (future)** | School instructor assigning study plans | Class management, bulk plan creation, performance analytics |

### Market Sizing (Caribbean region)

- **CSEC annual candidates:** ~150,000 across CARICOM nations
- **Addressable (internet access + willingness to pay):** ~60,000
- **Price point:** $5–15 USD/month (affordable for regional income levels)
- **TAM:** $3.6M–$10.8M annually

### Competitive Advantage

1. **CSEC-specific curriculum alignment** — competitors are generic (Khan Academy, Coursera)
2. **AI-generated content** at syllabus-level granularity — no need for human content authors to cover 70+ topics
3. **Adaptive difficulty** — wizard data (target grade, proficiency, confidence per topic) personalizes every lesson
4. **Caribbean English and cultural context** — examples, scenarios, and language resonate with the target audience

---

## 3. Current State Assessment

### What Works Well

| Feature | Status | Quality |
|---------|--------|---------|
| 6-step study plan wizard | ✅ Deployed | Good — captures target grade, proficiency, confidence, timeline, learning style |
| AI lesson generation | ✅ Deployed | Good — 10-section blueprint, STEM/Writing/General templates, 3,000–4,500 word output |
| Lesson caching (DB) | ✅ Deployed | Functional — checks `lessons` table before regenerating |
| Two-column sidebar outline | ✅ Deployed | Good — sticky desktop sidebar, mobile outline pill |
| Study calendar scheduler | ✅ Deployed | Good — topological sort, depth tiers, revision weeks |
| Interactive MCQ | ✅ Deployed | Good — click-to-answer with instant feedback |
| In-lesson chat (Q&A) | ✅ Deployed | Good — GPT-3.5, rate-limited, with guardrails |
| Student metrics pipeline | ✅ Deployed | Functional — mastery, streaks, daily activity |
| Usage tracking (ai_usage) | ✅ Deployed | Functional — tracks tokens, cost, model per API call |
| Math rendering (KaTeX) | ✅ Deployed | Good |

### Critical Issues to Fix (ordered by severity)

#### P0 — Security & Cost

1. **No auth on AI routes.** All 6 AI API endpoints (`/api/ai/coaching`, `/api/ai/practice`, `/api/ai/exam`, `/api/ai/chat`, `/api/ai/generate`, `/api/ai/analyze-plan`) are publicly accessible. Any bot or malicious actor can drain OpenRouter credits with no authentication.

2. **5 out of 9 LLM call sites bypass `callWithFallback()`.** The legacy methods `generateSTEMCoaching`, `generateWritingCoaching`, `generateGeneralCoaching`, `generatePracticeQuestions`, and `generatePracticeExam` call `MODELS.LESSON` directly. When credits run out, these throw unhandled 402 errors instead of falling back to the free model.

3. **3 API routes hardcode `anthropic/claude-3.5-sonnet`.** The practice, exam, and analyze-plan routes bypass the model-config system entirely — different model, no fallback, no usage tracking.

#### P1 — Cost Waste

4. **System prompt bloat: ~5,000–7,000 tokens per lesson call.** The `QUESTION_FORMAT_LIBRARY` constant alone is ~2,400 tokens. Combined with the 10-section blueprint, proficiency context, and vector search context, the system prompt dwarfs the actual user message. This is repeated in full on every lesson generation.

5. **Practice questions and exams use GPT-5.2.** These are structured output tasks (generate N questions with answers) that don't require a frontier model. GPT-4o-mini or even GPT-3.5 produces equivalent quality at 10–50× lower cost.

6. **Study guides are never cached.** `generateStudyGuide()` generates fresh on every call using the UTILITY tier. Low per-call cost but wasteful if called repeatedly for the same topic.

#### P2 — Architecture

7. **Three competing content generation paths.** The coaching API route, `ContentResolver.resolveLesson()`, and the direct practice/exam API routes do overlapping work with inconsistent caching and model selection.

8. **Dual caching implementations.** The coaching route and ContentResolver both read/write the `lessons` table but use different metadata formats (HTML comment header vs. raw content). If one caches and the other reads, metadata leaks into content.

9. **`lib/ai-coach-openrouter.ts` is dead code.** Defines a conflicting `AICoach` class with deprecated model names (`claude-3-sonnet`). Should be deleted.

10. **1,895-line monolithic coaching page.** Markdown rendering, MCQ interactivity, pagination, sidebar, chat — all in one `'use client'` component. Any state change re-renders everything.

#### P3 — Data Integrity

11. **Mock auth creates orphaned users.** `signIn()` creates a new mock user on every call — previous plans are inaccessible.

12. **`schema.sql` is stale.** Does not reflect column additions from 5+ migration files. No single source of truth for the DB schema.

13. **SELECT-then-UPDATE patterns** in `metrics.ts` where UPSERT should be used (2 round-trips instead of 1).

---

## 4. Architecture Overview

### v2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js App)                     │
│  ┌────────┐  ┌─────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Wizard │  │ Lesson  │  │ Practice │  │ Dashboard/Calendar │ │
│  │  Flow  │  │ Viewer  │  │  & Exam  │  │   & Metrics        │ │
│  └───┬────┘  └────┬────┘  └────┬─────┘  └────────┬───────────┘ │
│      │            │            │                  │             │
│      └────────────┴────────────┴──────────────────┘             │
│                           │ (Auth-gated API calls)              │
└───────────────────────────┼─────────────────────────────────────┘
                            │
              ┌─────────────▼──────────────┐
              │      API Gateway Layer      │
              │  ┌──────────────────────┐   │
              │  │  Auth Middleware      │   │
              │  │  Rate Limiter         │   │
              │  │  Request Validation   │   │
              │  └──────────────────────┘   │
              └─────────────┬──────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼─────┐     ┌──────▼─────┐     ┌──────▼──────┐
    │ Content  │     │   Model    │     │  Metrics &  │
    │ Service  │     │  Router    │     │  Analytics  │
    │          │     │            │     │             │
    │ • Cache  │     │ • Task     │     │ • Mastery   │
    │   check  │     │   classify │     │ • Streaks   │
    │ • Queue  │     │ • Prompt   │     │ • Activity  │
    │ • Store  │     │   build    │     │ • Trends    │
    └────┬─────┘     │ • Fallback │     └──────┬──────┘
         │           └──────┬─────┘            │
         │                  │                  │
    ┌────▼──────────────────▼──────────────────▼────┐
    │              Supabase (PostgreSQL)             │
    │  ┌──────────┐ ┌──────────┐ ┌────────────────┐ │
    │  │ lessons  │ │ ai_usage │ │ student_metrics│ │
    │  │ (cached) │ │ (costs)  │ │ daily_activity │ │
    │  └──────────┘ └──────────┘ │ quiz_results   │ │
    │  ┌──────────┐ ┌──────────┐ └────────────────┘ │
    │  │ plans    │ │ progress │ ┌────────────────┐ │
    │  │ wizard   │ │          │ │ csec_content   │ │
    │  │ data     │ │          │ │ (vectors, RAG) │ │
    │  └──────────┘ └──────────┘ └────────────────┘ │
    └───────────────────────────────────────────────┘
```

### Key Differences from v1

| Aspect | v1 | v2 |
|--------|----|----|
| Content generation | Direct LLM call in API route handlers | Content Service with cache-first, queue-backed generation |
| Model selection | Hardcoded per route or per method | Centralized Model Router with task classification |
| Authentication | None on API routes | Supabase Auth middleware on all routes |
| Caching | Two competing implementations | Single `ContentStore` with composite cache key |
| Component architecture | 1,895-line monolith | Modular: `LessonRenderer`, `MCQEngine`, `ChatPanel`, `SidebarOutline` |
| Prompt engineering | ~5,000-token system prompt per call | Compressed prompts + cached system instructions (OpenAI prefix caching) |
| Observability | Console logs | Structured logging + usage dashboards |

---

## 5. LLM Cost Optimization Strategy

This is the highest-impact area. The goal is to **deliver the same or better content quality at 60–80% lower LLM cost**.

### 5.1 Model Routing Matrix

Instead of one large model for everything, classify each task and route to the cheapest model that produces acceptable quality:

| Task | Current Model | v2 Model | Rationale | Est. Cost Reduction |
|------|--------------|----------|-----------|-------------------|
| **Lesson generation** (3,000–4,500 words) | GPT-5.2 ($$$) | GPT-4.1-mini → GPT-4.1 fallback | 4.1-mini produces high-quality structured educational content at 10× lower cost. Reserve 4.1 for topics flagged as low-quality. | **80%** |
| **Practice questions** (5–10 MCQs) | GPT-5.2 or Claude 3.5 Sonnet ($$$) | GPT-4o-mini | Structured output (JSON). Small models excel at this. | **90%** |
| **Practice exams** (15–20 questions) | GPT-5.2 or Claude 3.5 Sonnet ($$$) | GPT-4o-mini | Same rationale as practice questions. | **90%** |
| **Chat Q&A** (single response) | GPT-3.5 Turbo ($) | GPT-4o-mini | Slightly better quality, similar cost. | **0%** (already cheap) |
| **Plan analysis** (classification) | Claude 3.5 Sonnet ($$$) | GPT-4o-mini | Classification/extraction task — small model excels. | **95%** |
| **Study guide** (key points) | GPT-3.5 Turbo ($) | GPT-4o-mini | Similar cost, better quality. | **0%** |
| **Embeddings** | Local ONNX (free) | Local ONNX (free) | No change — already optimal. | **0%** |

**Model tier definitions for v2:**

```typescript
export const MODEL_TIERS = {
  GENERATION: 'openai/gpt-4.1-mini',      // Lesson content (primary workhorse)
  GENERATION_HQ: 'openai/gpt-4.1',         // High-quality fallback for flagged content
  STRUCTURED: 'openai/gpt-4o-mini',        // Quizzes, exams, classification, extraction
  CONVERSATIONAL: 'openai/gpt-4o-mini',    // Chat Q&A, study guides
  FREE_FALLBACK: 'meta-llama/llama-3.3-70b-instruct:free', // When credits exhausted
} as const
```

### 5.2 Prompt Compression

The current system prompt for lesson generation is ~5,000–7,000 tokens. This can be reduced to ~1,500–2,000 tokens through:

#### A. Extract the Question Format Library

The current `QUESTION_FORMAT_LIBRARY` is ~2,400 tokens injected into every prompt. Instead:

1. **Move to a system-level cached prefix** — OpenAI and Anthropic both cache system prompts that are identical across calls. If the first N tokens of the system prompt are identical, they're cached and not re-billed after the first call.
2. **Make question types per-lesson, not global** — A chemistry lesson doesn't need the "Creative Writing: Story Starter" or "Historical Analysis" question types. Select 3–4 relevant types per subject/topic and inject only those (~400 tokens instead of 2,400).

#### B. Compress the Blueprint

The current 10-section blueprint uses verbose natural language. Compress to a structured schema:

**Before (~2,000 tokens):**
```
## Section 1 — The Hook (Opening Page)
Purpose: Grab attention immediately with a relatable, real-world scenario...
(paragraph of instructions)

## Section 2 — What You Already Know  
Purpose: Bridge from existing knowledge...
(paragraph of instructions)
...
```

**After (~500 tokens):**
```
BLUEPRINT:
1. HOOK: Real-world scenario, visceral, Caribbean context. 1 paragraph.
2. PRIOR_KNOWLEDGE: "Have you ever...?" bridge. 3-4 sentences.
3. CORE_CONCEPT: Definition → analogy → formal. Include worked example.
4. DEEP_DIVE: Why it works, edge cases. Diagram if visual.
5. GUIDED_PRACTICE: 2 scaffolded problems. Show steps.
6. COMMON_MISTAKES: 3 pitfalls with corrections.
7. MCQ_CHECK: 3-4 multiple choice (A-D). Mark correct.
8. REAL_WORLD: Caribbean application. 1 example.
9. STRETCH: Extension for advanced students. 1 challenge.
10. SUMMARY: 5 bullet points. "What to review next."
```

#### C. Remove Redundant Context

The current prompt includes proficiency context, vector search results (RAG), AND the full blueprint. The vector search results often overlap with what the blueprint already asks for. Solution: inject RAG context only when the vector search returns high-relevance matches (similarity > 0.75).

**Projected savings:**

| Component | Current Tokens | v2 Tokens | Savings |
|-----------|---------------|-----------|---------|
| System prompt base | 2,000 | 800 | 60% |
| Question format library | 2,400 | 400 (subject-filtered) | 83% |
| Proficiency context | 300 | 200 (compressed) | 33% |
| Vector/RAG context | 1,500 (8 chunks × ~200 tokens) | 400 (2 chunks, filtered by relevance) | 73% |
| **Total system prompt** | **~6,200** | **~1,800** | **71%** |

At GPT-4.1-mini pricing (~$0.40/1M input tokens), the system prompt cost drops from ~$0.0025/lesson to ~$0.0007/lesson.

### 5.3 Aggressive Content Caching

#### Cache Everything That's Deterministic

| Content Type | Currently Cached? | v2 Strategy |
|-------------|-------------------|-------------|
| Lessons | ✅ Partially (two implementations) | ✅ Unified cache, composite key: `{subject}:{topic}:{target_grade}:{proficiency}:{version}` |
| Practice questions | ✅ Partially | ✅ Cache per difficulty level, invalidate on prompt version change |
| Practice exams | ❌ Never | ✅ Cache per topic set + difficulty. Shuffle question order on retrieval. |
| Study guides | ❌ Never | ✅ Cache per topic. These rarely change. |
| Chat responses | ❌ (appropriate) | ❌ Keep uncached — conversational by nature |
| Plan analysis | ❌ (appropriate) | ❌ Keep uncached — unique per student input |

#### Pre-Generation Pipeline

Instead of generating content on-demand (blocking the student while GPT-4.1-mini runs for 15–30 seconds), **pre-generate the most common content combinations**:

1. **Seed generation:** For each of the 70 topics × 3 proficiency levels = **210 base lessons**, generate and cache during off-peak hours.
2. **On-demand personalization:** When a student's wizard data doesn't match a cached variant, either:
   a. Serve the closest cached variant with a lightweight "personalization pass" (GPT-4o-mini adds/removes 2–3 paragraphs), or
   b. Queue a full generation and show a "preparing your lesson…" skeleton.
3. **Incremental cache warming:** After each new lesson generation, cache the result for future students with similar profiles.

**Cost of seeding:** 210 lessons × ~3,500 output tokens × ~2,000 input tokens = ~1.15M tokens total.  
At GPT-4.1-mini pricing: **~$2.50 one-time cost** to seed the entire curriculum.

### 5.4 Token Budget Enforcement

Every LLM call should have an explicit `max_tokens` ceiling:

```typescript
const TOKEN_BUDGETS = {
  lesson:         { input: 2500, output: 6000 },
  practice:       { input: 1200, output: 2000 },
  exam:           { input: 1500, output: 4000 },
  chat:           { input: 2000, output: 600  },
  study_guide:    { input: 1000, output: 1500 },
  plan_analysis:  { input: 2000, output: 800  },
} as const
```

### 5.5 Cost Observability

Every LLM call already writes to `ai_usage`. Enhance with:

1. **Real-time cost dashboard** — aggregate by model, action, time period
2. **Budget alerts** — when daily/weekly spend exceeds threshold
3. **Per-student cost tracking** — identify power users consuming disproportionate resources
4. **Cache hit rate monitoring** — measure how often cached content is served vs. generated
5. **Quality feedback loop** — if students report issues on cached content, flag for regeneration with HQ model

---

## 6. Content Ingestion & Vector Database

The quality of AI-generated content depends directly on the quality and coverage of the RAG knowledge base. RIPLESSONS must ingest **100–500 CSEC past papers and syllabi** (PDFs, including scanned documents) into a 384-dimensional vector database, and keep it current as CXC releases new material annually.

### 6.1 LangChain Assessment

| Context | Use LangChain? | Rationale |
|---------|---------------|----------|
| **Offline ingestion pipeline** (Python CLI) | **Yes** — `langchain-community` | PDF loaders (`PyMuPDFLoader`, `UnstructuredPDFLoader`), semantic `RecursiveCharacterTextSplitter`, `SupabaseVectorStore` connector. Mature Python SDK. Saves 2–3 weeks vs. custom code. |
| **Runtime RAG** (Next.js API routes) | **No** | Runtime pattern is simple: embed query → SQL RPC → inject context. LangChain.js adds ~100 sub-dependencies, bloats serverless cold starts by 3–5s, and the abstraction overhead isn't justified. |
| **Alternative for ingestion** | Consider `llama-index` | Slightly better for structured document parsing (PDFs with tables, mark schemes). But LangChain has broader community support. |

**Recommendation:** Use **LangChain Python** (`langchain-community[pdf]` + `langchain-text-splitters`) for the ingestion CLI tool. Keep **lightweight custom code** for runtime RAG in Next.js.

### 6.2 Current State & Critical Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **Dimension mismatch** | P0 | 4 TypeScript ingestion scripts produce 1536-dim embeddings (OpenAI `text-embedding-3-small`). DB column is `vector(384)`. These scripts **cannot insert data** post-migration. |
| **No deduplication** | P1 | All scripts use `.insert()` — re-running creates exact duplicates. No content hash or upsert. |
| **Topic inflation** | P1 | Python bulk script duplicates each chunk once per detected topic keyword. A chunk matching 3 topics creates 3 rows with identical content. |
| **Keyword-based classification** | P2 | Topic detection uses regex keyword matching ("algebra", "cells", etc.). Misclassifies multi-topic content and defaults to "General" for ~30% of chunks. |
| **No `explanation` content from PDFs** | P2 | Bulk script tags all content as `question` or `syllabus`. The AI coach primarily searches for `explanation` type, which only exists from manually curated TypeScript data (25 items). |
| **Duplicate source folders** | P2 | Math papers split across `math/`, `mathematics/`, `maths/` with ~40% file overlap. `maths/` contains solutions mixed with question papers. |
| **No incremental update** | P2 | Only option is truncate-and-reload. Adding 5 new 2026 papers requires re-processing all 500 documents. |
| **Subtopic always "Chunk N"** | P3 | No meaningful subtopic extraction from PDFs. |

### 6.3 v2 Ingestion Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    INGESTION CLI (Python + LangChain)                │
│                                                                      │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌────────────┐  │
│  │  Source   │   │  Document    │   │  Semantic  │   │  Topic     │  │
│  │  Scanner  │──▶│  Processor   │──▶│  Chunker   │──▶│ Classifier │  │
│  │          │   │              │   │            │   │            │  │
│  │ • PDF     │   │ • PyMuPDF    │   │ • LangChain│   │ • GPT-4o   │  │
│  │   detect  │   │   text PDF   │   │   Recursive│   │   -mini    │  │
│  │ • Dedup   │   │ • Tesseract  │   │   Splitter │   │   batch    │  │
│  │   (hash)  │   │   OCR scan   │   │ • Question │   │   API      │  │
│  │ • New-    │   │ • Structure  │   │   boundary │   │ • Map to   │  │
│  │   file    │   │   detection  │   │   aware    │   │   68 known │  │
│  │   detect  │   │              │   │            │   │   topics   │  │
│  └──────────┘   └──────────────┘   └────────────┘   └────────────┘  │
│                                                                      │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌────────────┐  │
│  │ Embedding │   │   Quality    │   │  Dedup &   │   │  Supabase  │  │
│  │ Generator │──▶│  Validator   │──▶│  Upsert    │──▶│  Upload    │  │
│  │          │   │              │   │            │   │            │  │
│  │ • MiniLM  │   │ • Min length │   │ • Content  │   │ • Batch    │  │
│  │   L6-v2   │   │ • Language   │   │   SHA-256  │   │   insert   │  │
│  │ • 384-dim │   │   detect     │   │   hash     │   │ • Progress │  │
│  │ • Local   │   │ • Garbled    │   │ • ON       │   │   logging  │  │
│  │   (free)  │   │   text check │   │   CONFLICT │   │ • Dry-run  │  │
│  │          │   │              │   │   skip     │   │   mode     │  │
│  └──────────┘   └──────────────┘   └────────────┘   └────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.4 PDF Processing & Intelligent Chunking

#### A. Document Processing

```python
# scripts/ingest.py — v2 ingestion pipeline
from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import pytesseract
from pdf2image import convert_from_path

def load_document(pdf_path: str) -> list[Document]:
    """Load PDF with text extraction, OCR fallback for scanned docs."""
    loader = PyMuPDFLoader(pdf_path)
    docs = loader.load()
    
    # Check if text was extracted (scanned PDFs return empty pages)
    text_content = ''.join(d.page_content for d in docs)
    if len(text_content.strip()) < 100:  # Likely scanned
        docs = ocr_fallback(pdf_path)
    
    return docs
```

#### B. Structure-Aware Chunking

The v1 chunker splits at fixed 500-character boundaries. v2 uses **document-structure-aware chunking**:

| Document Type | Chunking Strategy | Chunk Size | Overlap |
|--------------|-------------------|------------|--------|
| **Syllabus** | Split by section headings ("Section 1:", "Module 2:"). Each syllabus objective = 1 chunk. | 300–800 chars | 50 chars |
| **Past paper (text)** | Split by question number (`Q1.`, `1.`, `(a)`, `(b)`). Each question + subparts = 1 chunk. | 200–1,500 chars (variable) | 0 (questions are self-contained) |
| **Past paper (scanned)** | After OCR: same question-boundary splitting. Fall back to semantic splitter if structure unclear. | 400–1,000 chars | 100 chars |
| **Mark scheme / solutions** | Split by question, tag as `content_type: 'explanation'`. | 200–1,000 chars | 0 |

```python
def get_splitter(doc_type: str) -> TextSplitter:
    if doc_type == 'syllabus':
        return RecursiveCharacterTextSplitter(
            separators=["\nSection ", "\nModule ", "\n\n", "\n"],
            chunk_size=800, chunk_overlap=50,
            length_function=len
        )
    elif doc_type == 'past_paper':
        return QuestionBoundarySplitter(  # Custom splitter
            question_patterns=[r'\n\d+\.\s', r'\n\([a-z]\)\s', r'\nQuestion \d+'],
            max_chunk_size=1500
        )
    else:  # mark scheme, solutions
        return RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=100
        )
```

#### C. Content Type Classification

Instead of binary `question`/`syllabus`, classify into 4 types:

| Content Type | Source | How Detected | Used By |
|-------------|--------|-------------|---------|
| `syllabus` | Syllabus PDFs | Filename + directory path | Lesson generation (structure/scope) |
| `question` | Past papers | Question number patterns | Practice question & exam generation |
| `explanation` | Mark schemes, solutions, worked examples | Filename contains "mark scheme", "solution", "answer" | Lesson generation (explanations, common mistakes) |
| `example` | Textbook excerpts, worked examples | Manual designation or LLM classification | Lesson generation (examples section) |

### 6.5 LLM-Assisted Topic Classification

Replace keyword matching with **batch GPT-4o-mini classification** via OpenAI's Batch API (50% cost reduction):

```python
def classify_chunk(chunk_text: str, subject: str) -> dict:
    """Classify a chunk into topic + subtopic using GPT-4o-mini."""
    # Build prompt with the known topic list for this subject
    topics = CSEC_SUBJECTS[subject]['topics']  # From data/subjects.ts
    
    prompt = f"""Classify this CSEC {subject} content into ONE primary topic.

Known topics: {', '.join(topics)}

Content:
\"\"\" 
{chunk_text[:500]}
\"\"\"

Respond in JSON: {{"topic": "...", "subtopic": "...", "content_type": "question|syllabus|explanation|example", "confidence": 0.0-1.0}}"""
    
    return call_gpt4o_mini(prompt, json_mode=True)
```

**Cost of classification:** 500 documents × ~20 chunks/doc × ~200 input tokens = ~2M tokens.  
At GPT-4o-mini Batch API pricing ($0.075/1M input): **~$0.15 total** for classifying the entire corpus.

**Fallback:** If confidence < 0.6, fall back to keyword matching. If still unresolved, tag as `topic: 'General'` with a `needs_review: true` flag.

### 6.6 Embedding, Deduplication & Storage

#### A. Embedding Strategy

| Aspect | v1 | v2 |
|--------|----|----|  
| Model | `all-MiniLM-L6-v2` (384-dim) | **Same** — no change needed. Free, fast, good quality for retrieval. |
| Runtime | `sentence-transformers` (Python) / `@xenova/transformers` (ONNX) | Same — both produce identical 384-dim vectors |
| Batch size | 1 document at a time | **64 chunks per batch** — `model.encode(chunks, batch_size=64)` |
| Cost | Free (local) | Free (local) |

No reason to switch embedding models — `all-MiniLM-L6-v2` at 384 dimensions is the sweet spot for Supabase free tier storage limits. Upgrading to a larger model (e.g., `bge-large`, 1024-dim) would ~3× storage without proportionate retrieval improvement for our use case.

#### B. Deduplication via Content Hash

```python
import hashlib

def content_hash(text: str, subject: str, topic: str) -> str:
    """SHA-256 hash of normalized content + classification."""
    normalized = ' '.join(text.lower().split())  # Collapse whitespace
    return hashlib.sha256(f"{subject}:{topic}:{normalized}".encode()).hexdigest()[:32]
```

Add `content_hash TEXT UNIQUE` column to `csec_content`. Use `ON CONFLICT (content_hash) DO NOTHING` for idempotent inserts. Re-running the pipeline on the same PDFs inserts zero duplicates.

#### C. Schema Enhancement

```sql
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS content_hash TEXT UNIQUE;
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS source_file TEXT;       -- e.g., 'past-papers/math/CSEC-Math-Jan-2024.pdf'
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS page_number INTEGER;     -- PDF page
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS chunk_index INTEGER;     -- Position within document
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS classifier_confidence REAL;  -- 0-1 from LLM classification
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS year INTEGER;            -- Exam year
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS paper_number TEXT;        -- P1, P2, P3
ALTER TABLE csec_content ADD COLUMN IF NOT EXISTS session TEXT;             -- 'January' or 'May/June'

CREATE INDEX idx_csec_content_hash ON csec_content(content_hash);
CREATE INDEX idx_csec_content_source ON csec_content(source_file);
CREATE INDEX idx_csec_content_year ON csec_content(subject, year);
```

### 6.7 Incremental Updates

When CXC releases new past papers (annually, ~10–15 PDFs per session):

```
┌──────────────────────────────────────────────────┐
│               INCREMENTAL UPDATE FLOW             │
│                                                    │
│  1. Drop new PDFs into data/past-papers/{subject}/ │
│                    │                               │
│  2. Run: python scripts/ingest.py --incremental    │
│                    │                               │
│  3. Scanner detects new files (not in source_file  │
│     column of csec_content)                        │
│                    │                               │
│  4. Process ONLY new files through full pipeline    │
│     (extract → chunk → classify → embed → upsert)  │
│                    │                               │
│  5. Content hash dedup prevents duplicates even if │
│     a file is accidentally re-added                │
│                    │                               │
│  6. Log report: N new chunks added, M skipped      │
└──────────────────────────────────────────────────┘
```

**CLI interface:**

```bash
# Full reload (destructive — truncates and re-inserts)
python scripts/ingest.py --full --confirm-truncate

# Incremental (only new files)
python scripts/ingest.py --incremental

# Dry run (show what would be inserted, no writes)
python scripts/ingest.py --incremental --dry-run

# Specific subject only
python scripts/ingest.py --incremental --subject mathematics

# Re-classify existing content (e.g., after improving classifier)
python scripts/ingest.py --reclassify --subject biology

# Coverage report (what's indexed vs. what's in data/)
python scripts/ingest.py --report
```

### 6.8 RAG Integration at Runtime

The ingested content feeds into LLM prompts through the existing `VectorSearch.searchSimilarContent()` path, with v2 improvements:

#### A. Content-Type-Aware Retrieval

```typescript
class VectorSearch {
  // v2: Search by content type for the right context per task
  async searchForLesson(subject: string, topic: string): Promise<string> {
    // Lessons need explanations + syllabus scope
    const explanations = await this.search(query, { content_type: 'explanation', limit: 3, threshold: 0.75 })
    const syllabus = await this.search(query, { content_type: 'syllabus', limit: 2, threshold: 0.70 })
    return this.formatContext(explanations, syllabus)
  }

  async searchForPractice(subject: string, topic: string): Promise<string> {
    // Practice needs real past paper questions
    const questions = await this.search(query, { content_type: 'question', limit: 5, threshold: 0.65 })
    return this.formatQuestionContext(questions)
  }

  async searchForExam(subject: string, topics: string[]): Promise<string> {
    // Exams need questions across multiple topics
    const allQuestions = []
    for (const topic of topics) {
      const q = await this.search(topic, { content_type: 'question', limit: 3, threshold: 0.60 })
      allQuestions.push(...q)
    }
    return this.formatExamContext(allQuestions)
  }
}
```

#### B. Relevance Thresholds

| Task | Threshold | Max Chunks | Token Budget | Rationale |
|------|-----------|-----------|-------------|----------|
| Lesson generation | 0.75 | 5 | ~400 tokens | Only highly relevant context; avoid noise |
| Practice questions | 0.65 | 5 | ~500 tokens | Real past paper questions as style reference |
| Practice exam | 0.60 | 10 (across topics) | ~800 tokens | Broader coverage, lower threshold OK |
| Chat Q&A | 0.70 | 3 | ~300 tokens | Focused context for specific student questions |

#### C. Prompt Injection with Source Attribution

```
--- Relevant CSEC Content (from past papers & syllabus) ---

[Syllabus] CSEC Mathematics — Algebra:
Students should be able to: simplify algebraic expressions using the
laws of indices; solve linear equations and inequalities...

[Past Paper 2023, Q3] Simplify: 3x² + 2x - 5x² + 4x
Mark Scheme: -2x² + 6x (2 marks)

[Explanation] When simplifying algebraic expressions, collect like
terms by adding/subtracting coefficients of terms with the same
variable and exponent...
---
```

This structured injection ensures the LLM knows **what** each piece of context is (syllabus scope vs. real exam question vs. worked explanation) and can use it appropriately.

### 6.9 Vector DB Maintenance

#### A. Coverage Monitoring

Track how well the vector DB covers the curriculum:

```sql
-- Coverage report: chunks per subject × topic × content_type
SELECT
  subject,
  topic,
  content_type,
  COUNT(*) as chunk_count,
  COUNT(CASE WHEN needs_review THEN 1 END) as needs_review,
  MIN(year) as earliest_year,
  MAX(year) as latest_year,
  ROUND(AVG(classifier_confidence)::numeric, 2) as avg_confidence
FROM csec_content
GROUP BY subject, topic, content_type
ORDER BY subject, topic, content_type;
```

**Target coverage per topic:**

| Content Type | Minimum Chunks | Ideal Chunks |
|-------------|---------------|-------------|
| `syllabus` | 2 | 5–10 |
| `question` | 10 | 30–50 |
| `explanation` | 3 | 10–20 |
| `example` | 2 | 5–10 |

For 68 topics × ~70 chunks average = **~4,760 chunks** at full coverage.

#### B. Index Strategy

Use **HNSW index** (not IVFFlat) for the vector column:

```sql
CREATE INDEX idx_csec_embedding_hnsw ON csec_content
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**Why HNSW over IVFFlat:**
- No minimum row count requirement (IVFFlat needs `sqrt(N)` rows for `lists` parameter)
- Better recall at low row counts (< 100K)
- Works well for incremental inserts (IVFFlat requires periodic reindexing)
- Slightly more memory but within Supabase Pro limits for ~5K–50K chunks

#### C. Annual Maintenance Checklist

| When | Task | Effort |
|------|------|--------|
| **January** (after Jan exam session) | Ingest new January past papers (~6–8 PDFs) | 30 min |
| **July** (after May/June session) | Ingest new May/June past papers (~6–8 PDFs) | 30 min |
| **September** (new academic year) | Check for updated syllabi from CXC. Ingest if changed. | 1 hour |
| **Quarterly** | Run coverage report. Fill gaps for under-represented topics. | 2 hours |
| **Annually** | Review classifier accuracy on random sample of 100 chunks. Retrain/adjust if needed. | 4 hours |
| **On model change** | If embedding model is upgraded (unlikely), full re-embed: `--full --confirm-truncate` | 2 hours |

### 6.10 Content Inventory & Ingestion Estimate

**Current raw content on disk:**

| Source | Subject Dirs | Estimated PDFs | Notes |
|--------|-------------|---------------|-------|
| `data/past-papers/` | 8 (incl. duplicates) | ~120 | Math split across 3 folders; `unknown/` has misfiled papers |
| `data/syllabi/` | 33 | ~35 | Most subjects have 1 syllabus PDF |
| **Total on disk** | | **~155** | |
| **Target (v2)** | 6 core + expansion | **300–500** | Source from CXC website, teacher networks, school libraries |

**Processing estimates for 500 PDFs:**

| Step | Time | Cost |
|------|------|------|
| PDF text extraction | ~10 min (batch) | Free |
| OCR for scanned docs (~30% of corpus) | ~45 min | Free (local Tesseract) |
| Semantic chunking | ~5 min | Free |
| LLM topic classification (10K chunks) | ~15 min (batch API) | ~$0.15 |
| Embedding generation (10K chunks) | ~8 min (local GPU) or ~20 min (CPU) | Free |
| Supabase upload | ~5 min | Free |
| **Total** | **~1.5 hours** | **~$0.15** |

---

## 7. System Design

### 7.1 Content Service

The single biggest architectural change is consolidating all content generation into one service:

```typescript
class ContentService {
  // Single entry point for all content
  async getContent(request: ContentRequest): Promise<ContentResponse> {
    // 1. Check cache (Supabase lessons table)
    const cached = await this.store.get(request.cacheKey)
    if (cached && this.isValid(cached, request.promptVersion)) {
      return { content: cached, source: 'cache', cost: 0 }
    }

    // 2. Route to appropriate model
    const model = this.router.selectModel(request.type, request.priority)

    // 3. Build compressed prompt
    const prompt = this.promptBuilder.build(request)

    // 4. Generate
    const result = await this.llm.generate(model, prompt, TOKEN_BUDGETS[request.type])

    // 5. Cache result
    await this.store.set(request.cacheKey, result.content, {
      model: result.model,
      promptVersion: request.promptVersion,
      wizardSignature: request.wizardSignature,
    })

    // 6. Track usage
    await this.tracker.record(result.usage)

    return { content: result.content, source: 'generated', cost: result.usage.cost }
  }
}
```

### 7.2 Model Router

```typescript
class ModelRouter {
  selectModel(taskType: TaskType, priority: 'normal' | 'high_quality'): ModelConfig {
    // Check credit balance (cached)
    if (!this.hasCredits()) return { model: TIERS.FREE_FALLBACK, isFallback: true }

    // Route by task type
    switch (taskType) {
      case 'lesson':
        return priority === 'high_quality'
          ? { model: TIERS.GENERATION_HQ }
          : { model: TIERS.GENERATION }
      case 'practice':
      case 'exam':
      case 'plan_analysis':
        return { model: TIERS.STRUCTURED }
      case 'chat':
      case 'study_guide':
        return { model: TIERS.CONVERSATIONAL }
    }
  }
}
```

### 7.3 Prompt Builder

```typescript
class PromptBuilder {
  build(request: ContentRequest): { system: string; user: string } {
    const base = this.getBasePrompt(request.type)                  // ~500 tokens
    const blueprint = this.getCompressedBlueprint(request.type)    // ~500 tokens
    const questions = this.getSubjectQuestionTypes(request.subject) // ~400 tokens
    const rag = await this.getRelevantContext(request, 0.75)       // 0–400 tokens

    // Proficiency & wizard context
    const context = this.buildWizardContext(request.wizardData)    // ~200 tokens

    return {
      system: [base, blueprint, questions, context].join('\n\n'),
      user: `Generate a lesson on "${request.topic}" for CSEC ${request.subject}.${rag ? `\n\nRelevant syllabus context:\n${rag}` : ''}`
    }
  }
}
```

### 7.4 Component Architecture

Break the monolithic 1,895-line coaching page into composable modules:

```
app/plans/[id]/topics/[topic]/coaching/
├── page.tsx              (~100 lines) — Layout shell, data fetching
├── components/
│   ├── LessonRenderer.tsx (~300 lines) — Markdown → React, section splitting
│   ├── MCQEngine.tsx      (~200 lines) — Interactive quiz with state machine
│   ├── ChatPanel.tsx      (~150 lines) — Floating chat widget
│   ├── SidebarOutline.tsx  (~150 lines) — Section navigation with IntersectionObserver
│   ├── ProgressBar.tsx     (~50 lines)  — Sticky reading progress
│   └── Pagination.tsx      (~80 lines)  — Page navigation
├── hooks/
│   ├── useLesson.ts        — Content fetching + loading state
│   ├── usePagination.ts    — Page splitting logic
│   └── useReadProgress.ts  — Scroll tracking
└── utils/
    ├── parseMarkdown.ts    — Block detection (MCQ, blockquote, code)
    └── sectionSplitter.ts  — Content → pages
```

**Benefits:**
- Each component can be tested independently
- `MCQEngine` and `ChatPanel` can be lazy-loaded (`React.lazy()`)
- State changes in chat don't re-render the lesson body
- `LessonRenderer` can use `React.memo()` since lesson content is immutable once loaded

---

## 8. Data Model

### 8.1 Consolidated Schema

One authoritative schema file replacing the current 12 fragmented migrations:

```sql
-- ══════════════════════════════════════════════
-- RIPLESSONS v2 — Consolidated Database Schema
-- ══════════════════════════════════════════════

-- ── Users ────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  role          TEXT DEFAULT 'student' CHECK (role IN ('student', 'parent', 'teacher', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Study Plans ──────────────────────────────
CREATE TABLE IF NOT EXISTS study_plans (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  topics        JSONB NOT NULL DEFAULT '[]',
  status        TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  description   TEXT,
  help_areas    JSONB,
  attachments   JSONB,
  wizard_data   JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_study_plans_user ON study_plans(user_id);
CREATE INDEX idx_study_plans_status ON study_plans(user_id, status);

-- ── Topic Progress ───────────────────────────
CREATE TABLE IF NOT EXISTS progress (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id             TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  topic               TEXT NOT NULL,
  coaching_completed  BOOLEAN DEFAULT FALSE,
  practice_completed  BOOLEAN DEFAULT FALSE,
  exam_completed      BOOLEAN DEFAULT FALSE,
  practice_score      INTEGER,
  exam_score          INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, plan_id, topic)
);

CREATE INDEX idx_progress_plan ON progress(plan_id);

-- ── Cached Content ───────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subject         TEXT NOT NULL,
  topic           TEXT NOT NULL,
  content_type    TEXT NOT NULL DEFAULT 'coaching',
  content         TEXT NOT NULL,
  user_id         TEXT,
  -- Generation metadata
  model           TEXT,
  prompt_version  TEXT,
  wizard_signature TEXT,            -- Hash of wizard data that influenced this lesson
  is_fallback     BOOLEAN DEFAULT FALSE,
  vector_grounded BOOLEAN DEFAULT FALSE,
  -- Quality signals
  quality_score   REAL,             -- 0-1 automated quality score
  flagged         BOOLEAN DEFAULT FALSE,
  -- Housekeeping
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lessons_lookup ON lessons(subject, topic, content_type);
CREATE INDEX idx_lessons_cache ON lessons(subject, topic, content_type, prompt_version, wizard_signature);
CREATE INDEX idx_lessons_user ON lessons(user_id);

CREATE TABLE IF NOT EXISTS practice_questions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subject       TEXT NOT NULL,
  topic         TEXT NOT NULL,
  difficulty    TEXT DEFAULT 'medium',
  questions     JSONB NOT NULL,
  model         TEXT,
  prompt_version TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_practice_lookup ON practice_questions(subject, topic, difficulty);

CREATE TABLE IF NOT EXISTS exams (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subject       TEXT NOT NULL,
  topics        JSONB NOT NULL,
  difficulty    TEXT DEFAULT 'medium',
  exam_data     JSONB NOT NULL,
  model         TEXT,
  prompt_version TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Student Metrics ──────────────────────────
CREATE TABLE IF NOT EXISTS student_metrics (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL,
  plan_id             TEXT NOT NULL,
  subject             TEXT NOT NULL,
  topic               TEXT NOT NULL,
  -- Completion
  lessons_completed   INTEGER DEFAULT 0,
  lessons_total       INTEGER DEFAULT 1,
  completion_pct      INTEGER DEFAULT 0,
  -- Performance
  quiz_score_avg      REAL DEFAULT 0,
  quiz_attempts       INTEGER DEFAULT 0,
  best_quiz_score     REAL DEFAULT 0,
  problems_attempted  INTEGER DEFAULT 0,
  problems_correct    INTEGER DEFAULT 0,
  -- Mastery
  mastery_level       TEXT DEFAULT 'not_started',
  mastery_pct         INTEGER DEFAULT 0,
  -- Engagement
  total_time_minutes  INTEGER DEFAULT 0,
  lesson_retry_count  INTEGER DEFAULT 0,
  last_activity_at    TIMESTAMPTZ,
  -- Trends
  score_trend         REAL DEFAULT 0,
  predicted_grade     TEXT,
  --
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, plan_id, topic)
);

CREATE INDEX idx_metrics_user ON student_metrics(user_id);
CREATE INDEX idx_metrics_plan ON student_metrics(user_id, plan_id);

CREATE TABLE IF NOT EXISTS daily_activity (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           TEXT NOT NULL,
  activity_date     DATE NOT NULL,
  lessons_completed INTEGER DEFAULT 0,
  quizzes_taken     INTEGER DEFAULT 0,
  time_spent_minutes INTEGER DEFAULT 0,
  subjects_studied  JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, activity_date)
);

CREATE INDEX idx_activity_user ON daily_activity(user_id, activity_date DESC);

CREATE TABLE IF NOT EXISTS quiz_results (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT NOT NULL,
  plan_id             TEXT NOT NULL,
  subject             TEXT NOT NULL,
  topic               TEXT NOT NULL,
  score               REAL NOT NULL,
  total_questions     INTEGER NOT NULL,
  correct_answers     INTEGER NOT NULL,
  time_taken_seconds  INTEGER,
  questions           JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_user ON quiz_results(user_id, plan_id);

-- ── AI Usage Tracking ────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           TEXT,
  generation_id     TEXT,
  model             TEXT NOT NULL,
  action            TEXT NOT NULL,
  subject           TEXT,
  topic             TEXT,
  prompt_tokens     INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens      INTEGER DEFAULT 0,
  cost_credits      REAL DEFAULT 0,
  latency_ms        INTEGER,
  cached_tokens     INTEGER DEFAULT 0,
  cache_hit         BOOLEAN DEFAULT FALSE,  -- NEW: was this served from content cache?
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_time ON ai_usage(created_at DESC);
CREATE INDEX idx_usage_model ON ai_usage(model, action);

-- ── Vector Content (RAG) ─────────────────────
CREATE TABLE IF NOT EXISTS csec_content (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  subject       TEXT NOT NULL,
  topic         TEXT NOT NULL,
  subtopic      TEXT,
  content_type  TEXT NOT NULL,
  content       TEXT NOT NULL,
  metadata      JSONB DEFAULT '{}',
  embedding     vector(384),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_csec_content_lookup ON csec_content(subject, topic);

-- ── Dashboard Summary View ───────────────────
CREATE OR REPLACE VIEW student_dashboard_summary AS
SELECT
  user_id,
  COUNT(DISTINCT subject) AS subjects_count,
  COUNT(DISTINCT topic) AS topics_count,
  COALESCE(ROUND(AVG(completion_pct)), 0) AS avg_completion,
  COALESCE(ROUND(AVG(mastery_pct)), 0) AS avg_mastery,
  COALESCE(ROUND(AVG(quiz_score_avg)::numeric, 1), 0) AS avg_quiz_score,
  COALESCE(SUM(total_time_minutes), 0) AS total_study_minutes,
  COALESCE(SUM(lessons_completed), 0) AS total_lessons_done,
  MAX(last_activity_at) AS last_active,
  (SELECT COUNT(DISTINCT activity_date)
   FROM daily_activity da
   WHERE da.user_id = sm.user_id
     AND da.activity_date >= CURRENT_DATE - 30) AS days_active_30d
FROM student_metrics sm
GROUP BY user_id;

-- ── Functions ────────────────────────────────

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated      BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_plans_updated      BEFORE UPDATE ON study_plans    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_progress_updated   BEFORE UPDATE ON progress       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_metrics_updated    BEFORE UPDATE ON student_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Vector similarity search
CREATE OR REPLACE FUNCTION search_csec_content(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  filter_subject TEXT DEFAULT NULL,
  filter_topic TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  subject TEXT,
  topic TEXT,
  subtopic TEXT,
  content_type TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.subject, c.topic, c.subtopic, c.content_type, c.content, c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM csec_content c
  WHERE (filter_subject IS NULL OR c.subject = filter_subject)
    AND (filter_topic IS NULL OR c.topic = filter_topic)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Usage stats aggregation
CREATE OR REPLACE FUNCTION get_usage_stats(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'total_calls', COUNT(*),
    'total_tokens', COALESCE(SUM(total_tokens), 0),
    'total_cost', COALESCE(SUM(cost_credits), 0),
    'unique_users', COUNT(DISTINCT user_id),
    'cache_hit_rate', ROUND(
      COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0), 0) * 100, 1
    ),
    'by_model', (
      SELECT json_agg(json_build_object('model', model, 'calls', cnt, 'tokens', tkns, 'cost', cst))
      FROM (
        SELECT model, COUNT(*) cnt, SUM(total_tokens) tkns, SUM(cost_credits) cst
        FROM ai_usage WHERE created_at BETWEEN start_date AND end_date
        GROUP BY model ORDER BY cnt DESC
      ) sub
    ),
    'by_action', (
      SELECT json_agg(json_build_object('action', action, 'calls', cnt, 'tokens', tkns))
      FROM (
        SELECT action, COUNT(*) cnt, SUM(total_tokens) tkns
        FROM ai_usage WHERE created_at BETWEEN start_date AND end_date
        GROUP BY action ORDER BY cnt DESC
      ) sub
    )
  ) INTO result
  FROM ai_usage
  WHERE created_at BETWEEN start_date AND end_date;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### 8.2 Key Schema Changes from v1

| Change | Rationale |
|--------|-----------|
| `UNIQUE (user_id, plan_id, topic)` on `student_metrics` and `progress` | Enables `ON CONFLICT ... DO UPDATE` (UPSERT) instead of SELECT-then-UPDATE |
| `UNIQUE (user_id, activity_date)` on `daily_activity` | Same — enables single-query upserts |
| `prompt_version` and `wizard_signature` on `lessons` | Cache invalidation without deleting old rows |
| `quality_score` and `flagged` on `lessons` | Quality feedback loop — flag low-quality cached content for regeneration |
| `cache_hit` on `ai_usage` | Track cache effectiveness |
| `exams` table | Cache exam content (currently never cached) |
| Consolidated into one file | Single source of truth, no migration conflicts |

---

## 9. API Design

### 9.1 Route Structure

```
/api/
├── auth/
│   ├── signup          POST  — Create account
│   ├── login           POST  — Sign in
│   └── me              GET   — Current user
│
├── plans/
│   ├── /               GET   — List user's plans
│   ├── /               POST  — Create plan
│   ├── /[id]           GET   — Get plan details + progress
│   ├── /[id]           PATCH — Update plan
│   └── /[id]/schedule  GET   — Generate study calendar (pure computation)
│
├── content/
│   ├── /lesson         POST  — Get or generate lesson (cache-first)
│   ├── /practice       POST  — Get or generate practice questions
│   ├── /exam           POST  — Get or generate practice exam
│   ├── /study-guide    POST  — Get or generate study guide
│   └── /analyze        POST  — Analyze student input for plan suggestions
│
├── chat/
│   └── /               POST  — Lesson Q&A (streaming)
│
├── metrics/
│   ├── /               GET   — Dashboard summary
│   ├── /plan/[id]      GET   — Per-plan metrics
│   ├── /streak         GET   — Current streak
│   ├── /lesson         POST  — Record lesson completion
│   └── /quiz           POST  — Record quiz result
│
└── admin/
    ├── /usage          GET   — AI usage stats
    ├── /credits        GET   — OpenRouter credit balance
    ├── /cache          GET   — Cache hit rates
    ├── /users          GET   — All users with plan/quiz/exam counts
    ├── /users/[id]     GET   — Detailed user activity & plan breakdown
    └── /content/coverage GET — Vector DB coverage report per subject/topic
```

### 9.2 Auth Middleware

Every route under `/api/content/`, `/api/chat/`, `/api/metrics/`, and `/api/plans/` requires a valid Supabase JWT:

```typescript
// middleware.ts (Next.js middleware)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Protect API routes
  if (req.nextUrl.pathname.startsWith('/api/content') ||
      req.nextUrl.pathname.startsWith('/api/chat') ||
      req.nextUrl.pathname.startsWith('/api/metrics') ||
      req.nextUrl.pathname.startsWith('/api/plans')) {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return res
}
```

### 9.3 Rate Limiting

| Route | Limit | Window | Rationale |
|-------|-------|--------|-----------|
| `/api/content/lesson` | 10 | 1 hour | Each lesson = significant LLM cost |
| `/api/content/practice` | 20 | 1 hour | Cheaper but still paid |
| `/api/content/exam` | 5 | 1 hour | Most expensive content type |
| `/api/chat` | 30 | 15 min | Already exists; keep tight |
| `/api/content/analyze` | 5 | 1 hour | Used once during plan creation |

Implementation: Use Vercel KV (Redis) or Upstash for distributed rate limiting across serverless instances.

---

## 10. Feature Specifications

### 10.1 Study Plan Wizard (Refinement)

**Current:** 6-step wizard (subject → topics → exam timeline → schedule → learning style → proficiency assessment).

**v2 Changes:**
- Add **Step 0: Smart Intake** — free-text "tell us about yourself" + optional file upload. Analyzed by GPT-4o-mini (not Claude Sonnet) to suggest subject + topics automatically.
- Move proficiency assessment (topic_confidence) to a **lightweight diagnostic quiz** (5 MCQs per topic, generated from cached question bank, no LLM needed at quiz time).
- Store wizard_data as JSONB in `study_plans` (no change).

### 10.2 Lesson Viewer (Refactored)

**Current:** 1,895-line monolith with inline markdown parsing, MCQ rendering, pagination, chat, sidebar.

**v2 Changes:**
- Split into 6+ components (see Component Architecture above)
- Server-side markdown parsing via `unified` / `remark` pipeline → render AST on client
- Lazy-load `ChatPanel` and `MCQEngine` — not needed until user scrolls to them
- Images: Support AI-generated diagrams (future) via placeholder `[DIAGRAM: description]` syntax

### 10.3 Interactive MCQ (Enhancement)

**Current:** Click-to-answer with green/red feedback, auto-reveal explanation.

**v2 Changes:**
- Track per-question metrics (time-to-answer, correct/incorrect, retries)
- Show cumulative score bar at bottom of lesson
- Write quiz results to `quiz_results` table on lesson completion
- If student gets < 60% on in-lesson MCQs, surface a "Review this section?" prompt

### 10.4 Chat Q&A (Enhancement)

**Current:** Floating bubble, GPT-3.5, 600-token responses, rate-limited, injection detection.

**v2 Changes:**
- Streaming responses (SSE) for better perceived performance
- Context window: include current page content + relevant RAG chunks
- Conversation memory: store last 5 exchanges in session (not DB) to avoid ballooning context
- Model: GPT-4o-mini (marginally better quality, similar cost)

### 10.5 Practice Questions & Exams (Enhancement)

**Current:** Generated on-demand with Claude 3.5 Sonnet (no caching, no fallback, no usage tracking).

**v2 Changes:**
- Route through `ContentService` (unified caching + model routing)
- Model: GPT-4o-mini (structured output — JSON mode)
- Cache practice questions per `{subject}:{topic}:{difficulty}:{version}`
- Cache exams per `{subject}:{topics_hash}:{difficulty}:{version}`
- Shuffle question order on retrieval to prevent memorization
- Add `Structured Outputs` (OpenAI JSON schema mode) for guaranteed valid JSON

### 10.6 Student Dashboard (Enhancement)

**Current:** Basic plan list + metrics (mastery, streaks, daily activity).

**v2 Changes:**
- Weekly study heatmap (GitHub-style grid)
- Subject-level mastery radar chart
- "At Risk" topic alerts (mastery < 45%)
- Predicted grade based on mastery trajectory
- Study time vs. peer average (anonymized)

### 10.7 Study Calendar (No Change)

The current implementation (topological sort, depth tiers, time budgeting, revision weeks) is solid and requires no LLM calls. Keep as-is.

### 10.8 Admin Dashboard (New)

**Current:** Single admin page showing AI usage stats (total calls, tokens, cost) via `get_usage_stats()` RPC.

**v2 — Full admin console with user management:**

#### A. User Overview Table

| Column | Source | Sortable | Searchable |
|--------|--------|----------|------------|
| Name | `users.name` | ✅ | ✅ |
| Email | `users.email` | ✅ | ✅ |
| Registered | `users.created_at` | ✅ | |
| Plans | `COUNT(study_plans)` | ✅ | |
| Quizzes Taken | `COUNT(quiz_results)` | ✅ | |
| Exams Completed | `COUNT(progress WHERE exam_completed)` | ✅ | |
| Mastery Avg | `AVG(student_metrics.mastery_pct)` | ✅ | |
| Study Time | `SUM(student_metrics.total_time_minutes)` | ✅ | |
| Last Active | `MAX(student_metrics.last_activity_at)` | ✅ | |
| LLM Cost | `SUM(ai_usage.cost_credits) WHERE user_id` | ✅ | |

**Powered by a database view:**

```sql
CREATE OR REPLACE VIEW admin_user_overview AS
SELECT
  u.id,
  u.email,
  u.name,
  u.created_at AS registered_at,
  COUNT(DISTINCT sp.id) AS plan_count,
  COUNT(DISTINCT qr.id) AS quiz_count,
  COUNT(DISTINCT CASE WHEN p.exam_completed THEN p.id END) AS exam_count,
  COALESCE(ROUND(AVG(sm.mastery_pct)), 0) AS avg_mastery,
  COALESCE(SUM(sm.total_time_minutes), 0) AS total_study_minutes,
  MAX(sm.last_activity_at) AS last_active,
  COALESCE((SELECT SUM(cost_credits) FROM ai_usage au WHERE au.user_id = u.id), 0) AS total_llm_cost
FROM users u
LEFT JOIN study_plans sp ON sp.user_id = u.id
LEFT JOIN quiz_results qr ON qr.user_id = u.id
LEFT JOIN progress p ON p.user_id = u.id
LEFT JOIN student_metrics sm ON sm.user_id = u.id
GROUP BY u.id, u.email, u.name, u.created_at;
```

#### B. User Drill-Down

Click a user row → expanded view showing:
- All study plans (subject, topics, status, created date)
- Per-plan progress (topics completed, practice scores, exam scores)
- Quiz history (scores over time, trend chart)
- Daily activity timeline (heatmap)
- LLM cost breakdown (by action type)

#### C. Platform Overview Cards

| Card | Metric |
|------|--------|
| Total Users | `COUNT(users)` |
| Active Today / This Week | `COUNT(DISTINCT daily_activity WHERE activity_date >= today)` |
| Plans Created | `COUNT(study_plans)` |
| Lessons Delivered | `SUM(student_metrics.lessons_completed)` |
| Quizzes Taken | `COUNT(quiz_results)` |
| Exams Completed | `COUNT(progress WHERE exam_completed)` |
| LLM Spend (Today / MTD) | `SUM(ai_usage.cost_credits)` filtered by date |
| Cache Hit Rate | `cache_hits / (cache_hits + cache_misses)` from `ai_usage.cache_hit` |
| Vector DB Coverage | Chunks per topic (from coverage report) |

#### D. Content Ingestion Panel

- Show vector DB stats: total chunks, chunks per subject, latest ingestion date
- "Run Ingestion" button (triggers CLI pipeline via admin API + background job)
- Coverage gaps highlighted in red (topics with < 5 chunks)

---

## 11. Performance & Scalability

### 11.1 Performance Targets

| Metric | Target | Current (est.) |
|--------|--------|----------------|
| Cached lesson load (TTFB) | < 500ms | ~1,500ms |
| Fresh lesson generation | < 20s (with skeleton UI) | 15–45s (blocking) |
| Practice question generation | < 8s | 10–20s |
| Chat response (first token, streaming) | < 800ms | ~2,000ms |
| Dashboard load | < 1s | ~2s |
| Client JS bundle (gzipped) | < 200KB | ~350KB (est.) |

### 11.2 Optimization Strategies

#### A. Server-Side

1. **Edge caching for cached lessons.** Serve cached content from Vercel's edge network with `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`. Cache key includes wizard signature.

2. **Streaming for all AI responses.** Use OpenAI's streaming API + Server-Sent Events to send tokens as they arrive. Reduces perceived latency from 15–45s to ~1s for first token.

3. **Connection pooling for Supabase.** Use Supabase's connection pooler (PgBouncer) instead of direct connections. Critical at scale — serverless functions create new connections per invocation.

4. **UPSERT everywhere.** Replace all SELECT-then-UPDATE patterns in `metrics.ts` with:
   ```sql
   INSERT INTO student_metrics (user_id, plan_id, topic, ...)
   VALUES ($1, $2, $3, ...)
   ON CONFLICT (user_id, plan_id, topic)
   DO UPDATE SET lessons_completed = student_metrics.lessons_completed + 1, ...
   ```

#### B. Client-Side

1. **Code splitting.** Lazy-load `ChatPanel`, `MCQEngine`, `KaTeX` styles, and admin pages.

2. **React Server Components (RSC).** Use RSC for data-fetching pages (dashboard, plan list, admin). Only coaching/lesson interactivity needs `'use client'`.

3. **`next.config.ts` optimizations:**
   ```typescript
   export default {
     serverExternalPackages: ['@xenova/transformers'],
     images: { formats: ['image/avif', 'image/webp'] },
     experimental: { optimizeCss: true },
   }
   ```

4. **Skeleton UI for AI content.** Show a topic-specific skeleton (based on the 10-section blueprint) while content generates. The skeleton knows the section headers and approximate length.

### 11.3 Scalability Architecture

| Component | Scaling Strategy | Capacity |
|-----------|-----------------|----------|
| **Next.js (Vercel)** | Serverless auto-scaling | Thousands of concurrent requests |
| **Supabase (Postgres)** | Vertical scaling + read replicas | Free tier: 500MB, Pro: 8GB, scale as needed |
| **OpenRouter (LLM)** | Rate limits per model; fallback chain | Model-dependent; GPT-4.1-mini: ~5,000 RPM |
| **Embedding model** | Local ONNX on each serverless instance | Cold start ~5s; consider moving to Supabase edge function for warm instances |
| **Static assets** | Vercel CDN (edge) | Unlimited |

**For 10,000 concurrent students:**
- Most requests are cache hits (lessons, practice) → no LLM cost
- Chat is rate-limited to 30/15min → max ~20,000 chat calls/hour
- At GPT-4o-mini pricing (~$0.15/1M input, $0.60/1M output) → ~$3/hour for chat at peak load
- Background lesson generation (cache misses) handled by serverless functions with 60s timeout

---

## 12. Security & Authentication

### 12.1 Authentication (v2)

Remove the mock auth system entirely. Use Supabase Auth with:

1. **Email + password** (primary) with email verification
2. **Magic link** (secondary) for Caribbean students who forget passwords
3. **Google OAuth** (future phase) for frictionless signup
4. **Session management:** Supabase handles JWTs, refresh tokens, and session persistence automatically

### 12.2 Row-Level Security (RLS)

Move from permissive "demo mode" RLS to proper policies:

```sql
-- Users can only read their own data
ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own plans" ON study_plans
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users create own plans" ON study_plans
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users update own plans" ON study_plans
  FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users delete own plans" ON study_plans
  FOR DELETE USING (auth.uid()::text = user_id);

-- Service role bypasses RLS for server-side operations
-- (Supabase service role key automatically bypasses RLS)
```

### 12.3 API Security Checklist

| Control | v1 Status | v2 Requirement |
|---------|-----------|----------------|
| Auth on AI routes | ❌ None | ✅ JWT required |
| Rate limiting | ⚠️ Chat only | ✅ All content routes |
| Input validation | ⚠️ Chat only | ✅ Zod schemas on all routes |
| CSRF protection | ⚠️ Next.js default | ✅ Explicit SameSite cookies |
| API key exposure | ⚠️ Dead code risk | ✅ Delete `ai-coach-openrouter.ts`, audit all env usage |
| Content injection | ⚠️ Chat has detection | ✅ All user-supplied text sanitized |
| Cost ceiling | ❌ None | ✅ Daily spend limit with auto-disable |

### 12.4 Cost Protection

Implement a **cost circuit breaker**:

```typescript
const DAILY_SPEND_LIMIT = 10.00 // USD

async function checkCostBudget(): Promise<boolean> {
  const todayUsage = await getTodaySpend()
  if (todayUsage >= DAILY_SPEND_LIMIT) {
    console.error(`COST CIRCUIT BREAKER: Daily spend $${todayUsage} exceeds limit $${DAILY_SPEND_LIMIT}`)
    return false // reject the request
  }
  return true
}
```

---

## 13. Infrastructure & Deployment

### 13.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 15+ (App Router) | RSC support, built-in streaming, Vercel-native |
| **Hosting** | Vercel (Pro plan) | Auto-scaling, edge network, analytics, 60s function timeout |
| **Database** | Supabase (Pro plan) | Postgres, Auth, Realtime, Storage — all-in-one for small team |
| **Cache** | Vercel KV (Upstash Redis) | Rate limiting, session data, distributed counters |
| **LLM Provider** | OpenRouter | Multi-model access, credit management, fallback support |
| **Embeddings** | Local ONNX / Supabase Edge Function | Free, no external dependency |
| **Monitoring** | Vercel Analytics + custom dashboard | Build time, function duration, error rates |
| **CI/CD** | GitHub → Vercel (auto-deploy on push) | Current setup, works well |
| **Error tracking** | Sentry (free tier) | Production error visibility |

### 13.2 Environment Strategy

| Environment | Purpose | Database | LLM |
|-------------|---------|----------|-----|
| `local` | Development | Supabase local (Docker) or remote dev project | GPT-4o-mini only (cost control) |
| `preview` | PR review | Supabase staging project | GPT-4o-mini only |
| `production` | Live users | Supabase production project | Full model routing |

### 13.3 CI Pipeline

```yaml
# .github/workflows/ci.yml
- lint (ESLint + TypeScript)
- unit tests (Jest)
- build (next build)
- e2e tests (Playwright — headless)
- deploy (Vercel — automatic)
```

---

## 14. Phased Rollout Plan

### Phase 1: Foundation (Weeks 1–3)

**Goal:** Secure the platform and cut costs immediately. No new features.

| Task | Priority | Effort |
|------|----------|--------|
| Add auth middleware to all API routes | P0 | 2 days |
| Delete dead code (`ai-coach-openrouter.ts`, legacy methods) | P0 | 1 day |
| Route ALL LLM calls through `callWithFallback` | P0 | 1 day |
| Set `max_tokens` on all call sites | P0 | 0.5 days |
| Consolidate to single content generation path (ContentService) | P1 | 3 days |
| Implement model routing (practice/exam → GPT-4o-mini) | P1 | 1 day |
| Compress lesson prompt (5,000 → 1,800 tokens) | P1 | 2 days |
| Consolidate DB schema into single authoritative file | P2 | 1 day |
| Add Zod validation on all API routes | P2 | 2 days |
| Add daily cost circuit breaker | P0 | 0.5 days |

**Exit criteria:** All AI routes authenticated, all LLM calls through unified path, cost per lesson < $0.05.

### Phase 2: Content Ingestion & Performance (Weeks 4–7)

**Goal:** Build the RAG knowledge base and make everything fast.

| Task | Priority | Effort |
|------|----------|--------|
| **Content Ingestion Pipeline** | | |
| Build v2 ingestion CLI (LangChain Python, structure-aware chunking) | P0 | 3 days |
| Consolidate `math/` + `mathematics/` + `maths/` folders, clean `unknown/` | P1 | 0.5 days |
| Add `content_hash`, `source_file`, `year`, `paper_number` columns to `csec_content` | P1 | 0.5 days |
| LLM-assisted topic classification (batch API) | P1 | 1 day |
| Process all ~155 existing PDFs through v2 pipeline | P1 | 0.5 days |
| Source + ingest additional past papers to reach 300+ PDFs | P2 | 3 days (sourcing + processing) |
| Build coverage report CLI command | P2 | 0.5 days |
| Delete broken TypeScript ingestion scripts (1536-dim, hardcoded) | P1 | 0.5 days |
| **Performance** | | |
| Implement streaming responses (SSE) for lesson + chat | P1 | 3 days |
| Cache practice questions and exams | P1 | 2 days |
| Cache study guides | P2 | 0.5 days |
| Pre-generate seed content (210 base lessons) | P1 | 1 day (scripting) + $2.50 (LLM cost) |
| Break coaching page into components | P2 | 3 days |
| Add React.lazy() for ChatPanel, MCQEngine | P2 | 1 day |
| Configure `next.config.ts` optimizations | P3 | 0.5 days |
| UPSERT patterns in metrics.ts | P3 | 0.5 days |
| Skeleton UI for loading states | P2 | 1 day |
| Edge caching headers for cached content | P2 | 0.5 days |

**Exit criteria:** Vector DB has 3,000+ chunks across all 68 topics. Coverage report shows ≥ 10 chunks per topic for core 6 subjects. Cached lesson load < 500ms, fresh generation shows skeleton within 1s, bundle < 200KB.

### Phase 3: Auth & Data (Weeks 8–10)

**Goal:** Real users, real data integrity.

| Task | Priority | Effort |
|------|----------|--------|
| Remove mock auth, implement real Supabase Auth | P1 | 3 days |
| Email verification flow | P1 | 1 day |
| Proper RLS policies (per-user data isolation) | P1 | 2 days |
| Rate limiting via Vercel KV | P1 | 2 days |
| Password reset flow | P2 | 1 day |
| Diagnostic quiz for wizard (replace manual confidence) | P2 | 3 days |
| Error tracking (Sentry integration) | P2 | 1 day |

**Exit criteria:** Users can sign up, verify email, and log in. Data is isolated. Rate limits active.

### Phase 4: Analytics & Growth (Weeks 11–14)

**Goal:** Dashboard polish, investor-ready metrics.

| Task | Priority | Effort |
|------|----------|--------|
| Enhanced student dashboard (heatmap, radar chart) | P2 | 3 days |
| Admin dashboard — user table with plan/quiz/exam counts | P1 | 2 days |
| Admin dashboard — user drill-down (plans, scores, activity) | P2 | 2 days |
| Admin dashboard — platform overview cards | P2 | 1 day |
| Admin dashboard — content ingestion panel + coverage report | P2 | 1 day |
| `admin_user_overview` DB view + `/api/admin/users` route | P1 | 1 day |
| "At Risk" topic alerts | P3 | 1 day |
| Weekly progress email (if time permits) | P4 | 2 days |
| Landing page polish for investor demos | P2 | 2 days |
| Load testing (k6 or similar) | P2 | 1 day |

**Exit criteria:** Admin can see all users with plan/quiz/exam counts, drill into individual student data, monitor spend, cache rate, and vector DB coverage. Dashboard is investor-demo ready.

---

## 15. Success Metrics & KPIs

### Product KPIs

| Metric | Target (Month 1) | Target (Month 6) |
|--------|-------------------|-------------------|
| Registered students | 100 | 2,000 |
| Daily active users (DAU) | 20 | 400 |
| Lessons completed / week | 200 | 5,000 |
| Average mastery score | 55% | 70% |
| 7-day retention | 30% | 50% |
| NPS score | 30 | 50 |
| Paying subscribers | 0 (free beta) | 200 |

### Technical KPIs

| Metric | Target |
|--------|--------|
| Cache hit rate (lessons) | > 80% |
| P95 cached lesson TTFB | < 500ms |
| P95 fresh lesson gen time | < 25s |
| Avg LLM cost per lesson | < $0.05 |
| Avg LLM cost per chat msg | < $0.002 |
| Daily LLM spend / 100 DAU | < $5 |
| API error rate | < 0.5% |
| Uptime | 99.5% |

---

## 16. Cost Projections

### Per-Student Unit Economics

| Activity | Frequency | v1 Cost | v2 Cost (projected) |
|----------|-----------|---------|-------------------|
| Lesson generation (cache miss) | ~5/month (first month), ~1/month (ongoing) | $0.25 | $0.04 |
| Lesson view (cache hit) | ~20/month | $0.00 | $0.00 |
| Practice questions | ~10/month | $0.15 | $0.01 |
| Practice exam | ~3/month | $0.20 | $0.02 |
| Chat messages | ~30/month | $0.02 | $0.02 |
| **Monthly total per active student** | | **$1.50–$3.00** | **$0.15–$0.30** |

### Monthly Infrastructure Costs at Scale

| Component | 100 students | 1,000 students | 10,000 students |
|-----------|-------------|----------------|-----------------|
| Vercel (Pro) | $20 | $20 | $20 (+overages) |
| Supabase (Pro) | $25 | $25 | $75 (scale up) |
| OpenRouter (LLM) | $30 | $200 | $1,500 |
| Vercel KV (Redis) | $0 (free tier) | $10 | $30 |
| Sentry (free tier) | $0 | $0 | $26 |
| **Total** | **$75** | **$255** | **$1,651** |
| **Per student** | **$0.75** | **$0.26** | **$0.17** |

At a $10/month subscription: **gross margin of 93–98%** depending on scale.

---

## 17. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| OpenRouter pricing changes | Medium | High | Model router makes switching providers a config change. Maintain free fallback tier. |
| LLM quality regression (model updates) | Medium | Medium | Pin model versions (e.g., `gpt-4.1-mini-2025-04-14`). Quality scoring on cached content to detect degradation. |
| Supabase outage | Low | High | localStorage fallback exists (keep it). Consider read replicas for production. |
| Credit exhaustion (runaway costs) | Medium | High | Daily cost circuit breaker. Auto-disable generation above threshold. Alert via email/Slack. |
| Slow adoption in Caribbean market | Medium | Medium | Free tier for first 30 days. Partner with schools for bulk adoption. |
| Competitor enters CSEC-specific market | Low | Medium | First-mover advantage. Course content is cached and grows over time. Network effects from student usage data. |
| Prompt injection via student input | Medium | Low | Input sanitization on all routes (extends existing chat guardrails). Output filtering for policy violations. |
| Vector DB coverage gaps | Medium | Medium | Coverage report monitoring. Flag topics with < 5 chunks. Community sourcing of past papers from teachers. |
| OCR quality on scanned papers | Medium | Low | Manual review of low-confidence chunks (`needs_review` flag). Tesseract 5.x + image pre-processing. |
| Past paper copyright (CXC) | Low | Medium | Content is used for RAG context injection (fair use for education). Not displayed verbatim to students. Consult Caribbean IP counsel. |
| Data retention / GDPR-equivalent (Caribbean) | Low | Medium | Implement data export and deletion endpoints early. Anonymize analytics data. |

---

## 18. Appendices

### A. Current File Inventory (Key Files)

| File | Lines | Role | v2 Action |
|------|-------|------|-----------|
| `scripts/bulk_populate_vectors.py` | 290 | PDF ingestion pipeline (v1) | **Rewrite** as `scripts/ingest.py` with LangChain |
| `lib/ai-coach.ts` | 1,424 | Prompt templates + generation | Refactor into `PromptBuilder` + `ContentService` |
| `lib/ai-coach-openrouter.ts` | 180 | Dead code (duplicate AICoach) | **Delete** |
| `lib/model-config.ts` | 134 | Model tiers + fallback | Refactor into `ModelRouter` |
| `lib/content-resolver.ts` | 120 | Alternate content path | **Merge** into `ContentService` |
| `lib/lesson-cache.ts` | 100 | Cache metadata | **Merge** into `ContentStore` |
| `lib/usage-tracking.ts` | 140 | AI cost tracking | Keep, add cache_hit tracking |
| `lib/metrics.ts` | 463 | Student analytics | Refactor: UPSERT, remove duplicate DB calls |
| `lib/plan-storage.ts` | 200 | Plan CRUD (client) | Keep, improve error handling |
| `lib/plan-actions.ts` | 150 | Plan CRUD (server actions) | Keep |
| `lib/auth.tsx` | 200 | Mock + Supabase auth | **Rewrite** — remove mock auth |
| `lib/study-schedule.ts` | 300 | Calendar algorithm | Keep as-is (no LLM, pure computation) |
| `app/plans/[id]/topics/[topic]/coaching/page.tsx` | 1,895 | Lesson viewer | **Split** into 6+ components |
| `data/subjects.ts` | 260 | Curriculum data | Keep as-is |
| `components/interactive-mcq.tsx` | 200 | MCQ interaction | Enhance with analytics |
| `components/lesson-chat.tsx` | 150 | Chat widget | Add streaming |
| `scripts/populate-final.ts` | 100 | 1536-dim ingestion (broken) | **Delete** — wrong embedding dimension |
| `scripts/populate-simple.ts` | 50 | 1536-dim dummy vectors | **Delete** |
| `scripts/populate-demo.ts` | 80 | 1536-dim dummy vectors | **Delete** |
| `lib/content-downloader.ts` | 200 | 1536-dim OpenAI ingestion | **Delete** — replaced by `ingest.py` |
| `lib/content-downloader-openrouter.ts` | 200 | 1536-dim OpenRouter ingestion | **Delete** — replaced by `ingest.py` |

### B. LLM Call Audit Summary

| # | Call Site | Current Model | v2 Model | Uses Fallback? | Cached? | Tracked? |
|---|----------|--------------|----------|---------------|---------|----------|
| 1 | `generateTextbookLesson()` | GPT-5.2 | GPT-4.1-mini | ✅ | ✅ | ✅ |
| 2 | `generateStudyGuide()` | GPT-3.5 | GPT-4o-mini | ✅ | ❌→✅ | ✅ |
| 3 | `generateSTEMCoaching()` | GPT-5.2 | **Delete** (legacy) | ❌ | ❌ | ❌ |
| 4 | `generateWritingCoaching()` | GPT-5.2 | **Delete** (legacy) | ❌ | ❌ | ❌ |
| 5 | `generateGeneralCoaching()` | GPT-5.2 | **Delete** (legacy) | ❌ | ❌ | ❌ |
| 6 | `generatePracticeQuestions()` | GPT-5.2 | GPT-4o-mini | ❌→✅ | ❌→✅ | ❌→✅ |
| 7 | `generatePracticeExam()` | GPT-5.2 | GPT-4o-mini | ❌→✅ | ❌→✅ | ❌→✅ |
| 8 | Practice API route | Claude 3.5 Sonnet | GPT-4o-mini | ❌→✅ | ❌→✅ | ❌→✅ |
| 9 | Exam API route | Claude 3.5 Sonnet | GPT-4o-mini | ❌→✅ | ❌→✅ | ❌→✅ |
| 10 | Chat API route | GPT-3.5 | GPT-4o-mini | ✅ | ❌ | ✅ |
| 11 | Generate API (coaching) | GPT-5.2 | **Merge** into ContentService | ✅ | ✅ | ✅ |
| 12 | Generate API (exam) | GPT-5.2 | **Merge** into ContentService | ❌→✅ | ❌→✅ | ❌→✅ |
| 13 | Analyze Plan API | Claude 3.5 Sonnet | GPT-4o-mini | ❌→✅ | ❌ | ❌→✅ |
| 14–16 | ai-coach-openrouter.ts | Claude 3 Sonnet/Haiku | **Delete** (dead code) | ❌ | ❌ | ❌ |

### C. Curriculum Coverage

| Subject | Topics | Subtopics Defined | Prerequisites Mapped |
|---------|--------|-------------------|---------------------|
| Mathematics | 10 | 40 | 8 |
| English A | 10 | 0 | 0 |
| Biology | 13 | 10 | 10 |
| Chemistry | 13 | 9 | 11 |
| Physics | 11 | 9 | 8 |
| Principles of Business | 11 | 0 | 0 |
| **Total** | **68** | **68** | **37** |

### D. Glossary

| Term | Definition |
|------|-----------|
| CSEC | Caribbean Secondary Education Certificate — regional exam taken at age 16 |
| CARICOM | Caribbean Community — 15 member states |
| Wizard Data | Student preferences captured in 6-step onboarding (target grade, proficiency, confidence, timeline, learning style, schedule) |
| RAG | Retrieval-Augmented Generation — enriching LLM prompts with relevant syllabus content from vector search |
| Content Store | Unified cache layer backed by Supabase `lessons` / `practice_questions` / `exams` tables |
| Model Router | Service that selects the cheapest appropriate LLM for each task type |
| Content Service | Orchestrator: cache check → model routing → prompt building → generation → cache write → usage tracking |
| Prompt Version | Semantic version string tracked in cached content to invalidate stale lessons when prompts change |
| Wizard Signature | Hash of wizard_data fields that influence content personalization; used as part of cache key |

---

*End of PRD — Version 1.0*
