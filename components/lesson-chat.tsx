'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface LessonChatProps {
  subject: string
  topic: string
  userId?: string
  /** Current page's lesson text for additional context */
  lessonExcerpt?: string
}

export default function LessonChat({ subject, topic, userId, lessonExcerpt }: LessonChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sessionIdRef = useRef(`chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    setError(null)
    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(userId ? { 'x-user-id': userId } : {}) },
        body: JSON.stringify({
          message: trimmed,
          subject,
          topic,
          history: messages.slice(-10), // send last 10 messages for context
          sessionId: sessionIdRef.current,
          lessonExcerpt: lessonExcerpt?.slice(0, 2000),
          userId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (typeof data.remaining === 'number') setRemaining(data.remaining)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, subject, topic, userId, lessonExcerpt])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Floating bubble (closed state) ──────────────────────────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full px-5 py-3 shadow-lg transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        aria-label="Ask a question about this lesson"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-medium hidden sm:inline">Ask a Question</span>
      </button>
    )
  }

  // ── Chat panel (open state) ─────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-4rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white rounded-t-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="h-5 w-5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Study Helper</p>
            <p className="text-xs text-blue-100 truncate">{topic}</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 hover:bg-blue-500 rounded-full transition-colors"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8 px-4">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium text-gray-500 mb-1">Need help with something?</p>
            <p>Ask any question about <strong>{topic}</strong> and I&apos;ll explain it in a way that makes sense.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              {msg.content.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="text-center">
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 inline-block">{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="border-t border-gray-200 p-3">
        {remaining !== null && remaining <= 3 && (
          <p className="text-xs text-amber-600 mb-2 text-center">
            {remaining === 0 ? "You've reached the question limit." : `${remaining} question${remaining === 1 ? '' : 's'} remaining this session.`}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question..."
            rows={1}
            disabled={isLoading || remaining === 0}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 max-h-[80px] overflow-y-auto"
            style={{ minHeight: '38px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || remaining === 0}
            className="flex items-center justify-center w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl transition-colors flex-shrink-0"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
