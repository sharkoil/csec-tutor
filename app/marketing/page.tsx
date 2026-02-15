'use client'

import { useState } from 'react'
import Link from 'next/link'

/* ─────────────────────────────────────────────────────────────────────────────
   CSEC Tutor – Marketing Landing Page
   One-page site targeting students, parents, and teachers.
   ───────────────────────────────────────────────────────────────────────────── */

const COMPARISON: { feature: string; us: boolean; them: boolean | 'partial' }[] = [
  { feature: 'Knows the CSEC syllabus — every topic, every objective', us: true, them: false },
  { feature: 'Lessons aligned to the official CSEC syllabus and exam style', us: true, them: false },
  { feature: 'Saves your progress and remembers where you left off', us: true, them: false },
  { feature: 'Study plans tied to your actual exam date', us: true, them: false },
  { feature: 'Practice quizzes in real CSEC exam format', us: true, them: 'partial' },
  { feature: 'Mock exams with CSEC-style mark allocation', us: true, them: false },
  { feature: 'AI grading that follows CSEC marking style', us: true, them: 'partial' },
  { feature: 'Parents & teachers can see scores and progress', us: true, them: false },
  { feature: 'Finds your weak topics and focuses your study there', us: true, them: false },
  { feature: 'Content guided by real CSEC teachers', us: true, them: false },
  { feature: 'Safe — can\'t be used to write homework or go off-topic', us: true, them: false },
]

const AUDIENCES = [
  {
    id: 'students',
    icon: '🎓',
    title: 'Students',
    subtitle: 'Ages 13–17 preparing for CSEC',
    points: [
      'A personal tutor that actually knows your syllabus — not random internet answers that might be wrong',
      'Lessons explain every topic step-by-step, aligned to the actual CSEC syllabus — not Wikipedia summaries',
      'Practice with questions in the exact format you\'ll see on exam day — MCQ, short answer, extended response',
      'Write your answer, hit submit, and get instant marking with feedback — no waiting days for your teacher',
      'Your scores, progress, and weak areas are all saved — pick up right where you left off every session',
      'ChatGPT can make you a quiz, but it doesn\'t know what\'s actually on the CSEC exam. We do.',
    ],
    cta: 'ChatGPT forgets you the moment you close the tab. We remember every topic you\'ve covered.',
  },
  {
    id: 'parents',
    icon: '👨‍👩‍👧‍👦',
    title: 'Parents',
    subtitle: 'See exactly what your child is learning',
    points: [
      'Dashboard shows real completion rates and scores — you\'ll know if they\'re actually studying or just saying they are',
      'See which topics they\'re struggling with and where they\'re doing well — no more guessing',
      'Safe, focused environment — your child can\'t use it to write their homework for them or go off-topic',
      'Every lesson follows the actual CSEC syllabus, guided by experienced Caribbean teachers who know these subjects inside out',
      'All progress is saved — unlike ChatGPT, which starts from zero every conversation with no memory of your child',
      'Costs less than a single hour with a private tutor, but available 24/7 across all 31 subjects',
    ],
    cta: '$20/month for every subject, unlimited practice, and real progress tracking. A private tutor charges that per hour.',
  },
  {
    id: 'teachers',
    icon: '📚',
    title: 'Teachers',
    subtitle: 'Extend your classroom, save hours of prep',
    points: [
      'Assign topics and see exactly which students completed their lessons, practice, and exams',
      'All content is aligned to the CSEC syllabus and guided by experienced Caribbean educators',
      'Practice quizzes and exams follow CSEC exam format with proper mark allocation — not generic multiple choice',
      'Students get instant feedback on written answers, freeing you from grading mountains of homework',
      'Identify struggling students early — confidence ratings and scores show who needs extra attention',
      'Everything is stored: student progress, scores, and weak areas persist between sessions — not lost like a ChatGPT conversation',
    ],
    cta: 'Your teaching, amplified. Curriculum-aligned content with real teacher input.',
  },
]

const FAQS = [
  {
    q: 'How is this different from just using ChatGPT?',
    a: 'ChatGPT is a powerful tool — it can answer questions, generate quizzes, and even grade answers. But it doesn\'t know the CSEC syllabus and starts from scratch every time you open a new chat. CSEC Tutor is built specifically for CSEC: our lessons are aligned to the official syllabus, our quizzes match the actual exam format and marking style, and we save your child\'s progress, scores, and weak areas between sessions. Our content is guided by experienced Caribbean teachers who know exactly what the examiners are looking for. ChatGPT gives generic answers — we give CSEC-specific preparation.',
  },
  {
    q: 'What subjects are covered?',
    a: 'We currently cover 31 CSEC subjects including Mathematics, English A, Biology, Chemistry, Physics, Principles of Business, Geography, Social Studies, and more. All content is aligned to the official CSEC syllabus and guided by experienced Caribbean educators.',
  },
  {
    q: 'Can I see my child\'s progress?',
    a: 'Yes. Every study plan shows completion status for coaching lessons, practice quizzes, and mock exams. You can see scores, identify weak topics, and verify that your child is actually studying — not just saying they are.',
  },
  {
    q: 'Is the AI grading accurate?',
    a: 'Our AI grades using CSEC-style marking criteria. It awards partial marks, identifies strengths, highlights areas for improvement, and points out key concepts the student missed. While no AI is perfect, it provides immediate, substantive feedback that helps students improve between sessions.',
  },
  {
    q: 'What if my child is a complete beginner in a subject?',
    a: 'The study plan wizard assesses your child\'s current level and confidence in each topic. Lessons are then generated at the right depth — from foundational concepts for beginners to exam-technique focused content for advanced students. The AI adapts to where your child actually is, not where a textbook assumes they should be.',
  },
  {
    q: 'Is it safe for my child to use?',
    a: 'Absolutely. Unlike ChatGPT, CSEC Tutor is focused exclusively on CSEC curriculum content. Students can\'t use it to generate inappropriate content, browse the internet, or go off-topic. Every interaction is educational and curriculum-aligned.',
  },
  {
    q: 'Can it replace a private tutor?',
    a: 'For many students, yes — especially for content understanding, practice, and exam preparation. A private tutor costs $80–150+ per month for just one subject, one hour per week. CSEC Tutor provides unlimited access to all subjects, 24/7, with instant feedback. Our content is guided by experienced CSEC teachers who\'ve shaped the curriculum and best practices. For students who need in-person support, it\'s the perfect complement — they arrive at tutoring sessions better prepared.',
  },
]

const STATS = [
  { value: '31', label: 'CSEC Subjects' },
  { value: '24/7', label: 'Availability' },
  { value: '100%', label: 'Syllabus Aligned' },
  { value: '∞', label: 'Practice Questions' },
]

export default function MarketingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [activeAudience, setActiveAudience] = useState('students')

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Navigation ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📘</span>
            <span className="text-xl font-bold text-gray-900">CSEC Tutor</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#why" className="hover:text-gray-900 transition-colors">Why CSEC Tutor</a>
            <a href="#compare" className="hover:text-gray-900 transition-colors">vs ChatGPT</a>
            <a href="#audiences" className="hover:text-gray-900 transition-colors">Who It&apos;s For</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
          </div>
          <Link href="/auth" className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 via-white to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <span>🇹🇹🇯🇲🇧🇧🇬🇾🇧🇿🇱🇨</span>
            <span>Built for Caribbean students</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 text-gray-900">
            ChatGPT Doesn&apos;t Know<br />
            <span className="text-blue-600">Your CSEC Syllabus.</span><br />
            We Do.
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered tutoring built on the <strong>actual CSEC curriculum</strong>, 
            with <strong>syllabus-aligned content</strong> and <strong>exam-style marking</strong>. 
            Structured lessons, practice quizzes, mock exams, and instant AI grading — 
            for <strong>every subject</strong>, at a fraction of the cost of a private tutor.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/auth" className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Start Your Free Trial →
            </Link>
            <a href="#compare" className="w-full sm:w-auto border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition-all">
              See the Difference
            </a>
          </div>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">{s.value}</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem ─────────────────────────────────────────────── */}
      <section id="why" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">ChatGPT Is Smart. But It&apos;s Not Enough.</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              ChatGPT can answer questions and even make quizzes — but it doesn&apos;t know what&apos;s
              on the CSEC exam, and it forgets everything the moment you close the chat.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '🧠',
                title: 'No Memory Between Sessions',
                desc: 'Every ChatGPT conversation starts from zero. It doesn\'t remember what your child studied last week, which topics they\'re weak in, or what score they got. CSEC Tutor saves everything.',
              },
              {
                icon: '🎯',
                title: 'Not Built for CSEC',
                desc: 'ChatGPT can generate a quiz — but not in CSEC exam format, with proper mark schemes, or covering the right syllabus objectives. It doesn\'t know what the examiner is looking for.',
              },
              {
                icon: '👩‍🏫',
                title: 'No Real Teachers Behind It',
                desc: 'CSEC Tutor\'s content is guided by experienced Caribbean teachers who know the syllabus, the marking scheme, and what students actually struggle with. ChatGPT is guessing.',
              },
            ].map(item => (
              <div key={item.title} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How CSEC Tutor Works</h2>
            <p className="text-lg text-gray-600">Four steps from signup to exam-ready confidence.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: '1', icon: '📋', title: 'Tell Us Your Level', desc: 'Pick your subjects, target grade, and confidence in each topic. The AI builds a personalised plan.' },
              { step: '2', icon: '📖', title: 'Learn With AI Lessons', desc: 'Deep, syllabus-aligned lessons covering every CSEC topic in detail — not generic internet summaries.' },
              { step: '3', icon: '✍️', title: 'Practice & Get Graded', desc: 'MCQ quizzes, short answer, and extended response questions — all graded instantly by AI with detailed feedback.' },
              { step: '4', icon: '🏆', title: 'Track & Improve', desc: 'See exactly where you\'re strong and where you need work. Parents and teachers can monitor progress.' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4">{item.step}</div>
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ─────────────────────────────────────────── */}
      <section id="compare" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">CSEC Tutor vs ChatGPT</h2>
            <p className="text-lg text-gray-600">ChatGPT is smart — but it doesn&apos;t know your syllabus, save your progress, or follow your exam format.</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_100px] sm:grid-cols-[1fr_120px_120px] bg-gray-50 border-b border-gray-200">
              <div className="p-4 text-sm font-semibold text-gray-500 uppercase tracking-wider">Feature</div>
              <div className="p-4 text-center text-sm font-bold text-blue-700">CSEC Tutor</div>
              <div className="p-4 text-center text-sm font-bold text-gray-500">ChatGPT</div>
            </div>
            {/* Rows */}
            {COMPARISON.map((row, i) => (
              <div key={i} className={`grid grid-cols-[1fr_100px_100px] sm:grid-cols-[1fr_120px_120px] ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${i < COMPARISON.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div className="p-4 text-sm text-gray-700">{row.feature}</div>
                <div className="p-4 text-center text-lg">{row.us ? '✅' : '❌'}</div>
                <div className="p-4 text-center text-lg">{row.them === true ? '✅' : row.them === 'partial' ? '⚠️' : '❌'}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">⚠️ = ChatGPT can do this in a general way, but not specifically for CSEC format, syllabus, or mark schemes</p>
        </div>
      </section>

      {/* ── Audience Sections ────────────────────────────────────────── */}
      <section id="audiences" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built For Everyone In The Education Journey</h2>
            <p className="text-lg text-gray-600">Whether you&apos;re studying, parenting, or teaching.</p>
          </div>

          {/* Audience tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {AUDIENCES.map(a => (
              <button
                key={a.id}
                onClick={() => setActiveAudience(a.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  activeAudience === a.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="text-lg">{a.icon}</span>
                {a.title}
              </button>
            ))}
          </div>

          {/* Active audience content */}
          {AUDIENCES.filter(a => a.id === activeAudience).map(a => (
            <div key={a.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 sm:p-12 border border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{a.icon}</span>
                <div>
                  <h3 className="text-2xl font-bold">{a.title}</h3>
                  <p className="text-gray-500 text-sm">{a.subtitle}</p>
                </div>
              </div>
              <ul className="mt-6 space-y-4">
                {a.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">✓</span>
                    <span className="text-gray-700 leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 p-4 bg-white/70 rounded-xl border border-blue-200">
                <p className="text-blue-800 font-semibold text-center italic">&ldquo;{a.cta}&rdquo;</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cost Comparison ──────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">The Math Speaks For Itself</h2>
          <p className="text-lg text-gray-400 mb-12">Compare the cost of real CSEC preparation options.</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Private Tutor */}
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Private Tutor</div>
              <div className="text-4xl font-extrabold mb-1">$80–150<span className="text-lg font-normal text-gray-500">/mo</span></div>
              <div className="text-sm text-gray-500 mb-6">Per subject, 1hr/week</div>
              <ul className="text-left space-y-2 text-sm text-gray-400">
                <li>• 1 subject only</li>
                <li>• 4 hours per month</li>
                <li>• Quality varies wildly</li>
                <li>• No progress dashboard</li>
                <li>• Scheduling headaches</li>
              </ul>
            </div>
            {/* CSEC Tutor */}
            <div className="bg-blue-600 rounded-2xl p-8 border-2 border-blue-400 shadow-xl shadow-blue-900/30 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-4 py-1 rounded-full">BEST VALUE</div>
              <div className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-2">CSEC Tutor</div>
              <div className="text-4xl font-extrabold mb-1">$20<span className="text-lg font-normal text-blue-300">/mo</span></div>
              <div className="text-sm text-blue-300 mb-6">All subjects, unlimited</div>
              <ul className="text-left space-y-2 text-sm text-blue-100">
                <li>• <strong>31 CSEC subjects</strong></li>
                <li>• <strong>Unlimited</strong> lessons & practice</li>
                <li>• Syllabus-aligned exam-style content</li>
                <li>• AI grading with feedback</li>
                <li>• Guided by real CSEC teachers</li>
                <li>• Progress saved between sessions</li>
                <li>• Available 24/7</li>
              </ul>
            </div>
            {/* ChatGPT */}
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">ChatGPT</div>
              <div className="text-4xl font-extrabold mb-1">Free<span className="text-lg font-normal text-gray-500">*</span></div>
              <div className="text-sm text-gray-500 mb-6">*Plus is $20/mo too</div>
              <ul className="text-left space-y-2 text-sm text-gray-400">
                <li>• No CSEC syllabus knowledge</li>
                <li>• Can make quizzes, but not CSEC format</li>
                <li>• Forgets everything each session</li>
                <li>• No saved progress or scores</li>
                <li>• No real teacher input</li>
                <li>• Can be used to write homework</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing CTA ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-10 sm:p-14 text-center text-white shadow-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to Give Your Student the Edge?</h2>
            <p className="text-lg text-blue-100 mb-3 max-w-xl mx-auto">
              Join thousands of Caribbean students preparing smarter for their CSEC exams.
            </p>
            <p className="text-blue-200 text-sm mb-8">
              Start with a <strong>free trial</strong> — no credit card required. See the difference in one lesson.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth" className="w-full sm:w-auto bg-white text-blue-700 px-10 py-4 rounded-xl text-lg font-bold hover:bg-blue-50 transition-all shadow-lg">
                Start Free Trial →
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-6 text-center border-t border-blue-500/30 pt-8">
              <div>
                <div className="text-2xl font-bold">🔒</div>
                <div className="text-xs text-blue-200 mt-1">Safe &amp; Focused</div>
              </div>
              <div>
                <div className="text-2xl font-bold">📊</div>
                <div className="text-xs text-blue-200 mt-1">Track Progress</div>
              </div>
              <div>
                <div className="text-2xl font-bold">🎯</div>
                <div className="text-xs text-blue-200 mt-1">CSEC Aligned</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
                >
                  <span className="font-semibold text-gray-900">{faq.q}</span>
                  <span className={`flex-shrink-0 text-2xl text-gray-400 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Don&apos;t Let Your Child Use the Wrong Tool<br />
            for the Most Important Exams of Their Life.
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            CSEC exams determine their future. Give them preparation that&apos;s built for the task — 
            not a general chatbot that&apos;s guessing.
          </p>
          <Link href="/auth" className="inline-block bg-blue-600 text-white px-10 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
            Start Your Free Trial Today →
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="py-10 px-4 sm:px-6 lg:px-8 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📘</span>
            <span className="text-sm font-semibold text-white">CSEC Tutor</span>
            <span className="text-sm">— AI-powered CSEC exam preparation</span>
          </div>
          <div className="text-xs text-gray-500">
            © {new Date().getFullYear()} CSEC Tutor. Built for Caribbean students. 🇹🇹🇯🇲🇧🇧🇬🇾🇧🇿🇱🇨
          </div>
        </div>
      </footer>
    </div>
  )
}
