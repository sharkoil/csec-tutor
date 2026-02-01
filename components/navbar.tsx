'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { BookOpen, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'

export function Navbar() {
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    setIsOpen(false)
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href={user ? '/dashboard' : '/'} className="flex items-center space-x-2 group">
            <div className="bg-gradient-to-br from-primary to-secondary p-2 rounded-lg group-hover:shadow-lg transition-shadow">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-lg text-foreground">CSEC Tutor</span>
              <span className="text-xs text-muted-foreground">Learn. Practice. Succeed.</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">
                  Welcome, <span className="font-semibold text-foreground">{user.email?.split('@')[0]}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="group"
                >
                  <LogOut className="h-4 w-4 mr-2 group-hover:animate-pulse" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                  Sign In
                </Link>
                <Link href="/auth">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 border-t border-border/40">
            {user ? (
              <>
                <div className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground px-4">
                    Signed in as <span className="font-semibold text-foreground">{user.email}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full mx-4"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link href="/auth">
                  <Button className="w-full mx-4 mb-2">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
