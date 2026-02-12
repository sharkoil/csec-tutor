'use client'

import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface MathRendererProps {
  children: string
  display?: boolean
  className?: string
}

/**
 * Renders LaTeX math expressions using KaTeX
 * 
 * @param children - The LaTeX string to render
 * @param display - If true, renders in display mode (centered, larger)
 * @param className - Additional CSS classes
 */
export function MathRenderer({ children, display = false, className = '' }: MathRendererProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: {
          '\\RR': '\\mathbb{R}',
          '\\NN': '\\mathbb{N}',
          '\\ZZ': '\\mathbb{Z}',
          '\\QQ': '\\mathbb{Q}',
          '\\degree': '^\\circ',
        },
      })
    } catch (error) {
      console.error('KaTeX rendering error:', error)
      return `<span class="text-red-500">${children}</span>`
    }
  }, [children, display])

  return (
    <span
      className={`katex-container ${display ? 'block my-4 text-center' : 'inline'} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * Parse text and render math expressions
 * Supports:
 * - Inline math: $...$ or \(...\)
 * - Display math: $$...$$ or \[...\]
 * 
 * @param text - Text containing math expressions
 * @returns React nodes with rendered math
 */
export function renderMathInText(text: string): React.ReactNode[] {
  if (!text) return []
  
  const elements: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  
  // Combined regex for all math patterns
  // Order matters: check $$ before $ to avoid partial matches
  const mathRegex = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\$([^$\n]+?)\$|\\\(([^)]+?)\\\)/g
  
  let match
  while ((match = mathRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index))
    }
    
    // Determine if display or inline math
    const displayMath = match[1] ?? match[2] // $$ or \[
    const inlineMath = match[3] ?? match[4]  // $ or \(
    
    if (displayMath !== undefined) {
      elements.push(
        <MathRenderer key={key++} display={true}>
          {displayMath.trim()}
        </MathRenderer>
      )
    } else if (inlineMath !== undefined) {
      elements.push(
        <MathRenderer key={key++} display={false}>
          {inlineMath.trim()}
        </MathRenderer>
      )
    }
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex))
  }
  
  return elements.length > 0 ? elements : [text]
}

/**
 * Check if text contains any math expressions
 */
export function containsMath(text: string): boolean {
  return /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$\n]+?\$|\\\([^)]+?\\\)/.test(text)
}
