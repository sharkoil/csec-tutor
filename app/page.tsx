'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { FeatureCard } from '@/components/ui/feature-card'
import { Badge } from '@/components/ui/badge'
import { Loader2, BookOpen, Target, Award, TrendingUp, Users, Zap, CheckCircle, ArrowRight, Brain, Clock, Trophy } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-secondary/20 rounded-full blur-3xl opacity-20" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-6">
              <Badge variant="secondary">🚀 Master Your CSEC Exams</Badge>
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
              Learn Smarter with
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent"> AI-Powered Coaching</span>
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Personalized lesson plans, interactive coaching, and realistic practice exams. Prepare for CSEC success at your own pace.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <Button size="lg" className="text-lg px-8 py-7 h-auto">
                  Start Your Free Journey
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="text-lg px-8 py-7 h-auto">
                See How It Works
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 sm:gap-8 mb-16 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">1000+</div>
              <p className="text-sm text-muted-foreground">Students Prepared</p>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-secondary mb-2">95%</div>
              <p className="text-sm text-muted-foreground">Pass Rate</p>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-accent mb-2">24/7</div>
              <p className="text-sm text-muted-foreground">AI Available</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 sm:py-32 border-t border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools and features designed to help Caribbean students excel on their CSEC exams
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Brain className="h-6 w-6" />}
              title="AI-Powered Coaching"
              description="Get personalized explanations and learning tips tailored to your learning style and pace"
              iconBg="primary"
            />

            <FeatureCard
              icon={<Target className="h-6 w-6" />}
              title="Personalized Study Plans"
              description="Custom-built lesson plans based on CSEC curriculum and your learning goals"
              iconBg="secondary"
            />

            <FeatureCard
              icon={<Trophy className="h-6 w-6" />}
              title="Practice Exams"
              description="Realistic, timed practice tests that simulate actual CSEC exam conditions"
              iconBg="accent"
            />

            <FeatureCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Progress Tracking"
              description="Detailed analytics to monitor your improvement and identify areas for focus"
              iconBg="success"
            />

            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Instant Feedback"
              description="Get immediate responses to your questions and practice attempts"
              iconBg="warning"
            />

            <FeatureCard
              icon={<Clock className="h-6 w-6" />}
              title="Learn 24/7"
              description="Study whenever you want, wherever you want, at your own pace"
              iconBg="error"
            />
          </div>
        </div>
      </section>

      {/* Subjects Section */}
      <section className="py-20 sm:py-32 bg-card/50 border-t border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Multiple CSEC Subjects
            </h2>
            <p className="text-lg text-muted-foreground">
              Comprehensive coverage of all major CSEC examination subjects
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { name: 'Mathematics', emoji: '📐' },
              { name: 'English A', emoji: '📚' },
              { name: 'Biology', emoji: '🧬' },
              { name: 'Chemistry', emoji: '⚗️' },
              { name: 'Physics', emoji: '⚛️' },
              { name: 'Principles of Business', emoji: '💼' },
            ].map((subject) => (
              <div
                key={subject.name}
                className="p-6 rounded-xl border border-border/40 bg-background hover:border-primary/50 hover:shadow-lg transition-all duration-300 text-center"
              >
                <div className="text-4xl mb-3">{subject.emoji}</div>
                <h3 className="text-lg font-semibold text-foreground">{subject.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-32 border-t border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Your Success Journey
            </h2>
            <p className="text-lg text-muted-foreground">
              Simple, proven steps to CSEC exam mastery
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: 1,
                title: 'Create Account',
                description: 'Sign up in seconds with your email',
              },
              {
                step: 2,
                title: 'Choose Subjects',
                description: 'Select CSEC subjects you\'re preparing for',
              },
              {
                step: 3,
                title: 'Get Coaching',
                description: 'Learn with AI-powered guidance and tips',
              },
              {
                step: 4,
                title: 'Practice & Excel',
                description: 'Take tests and track your progress',
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-2xl font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {item.step < 4 && (
                  <div className="hidden md:block absolute top-8 -right-3 w-6 text-primary text-2xl">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-32 bg-card/50 border-t border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              What Students Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: 'Maria Chen',
                role: 'Student',
                text: 'CSEC Tutor helped me raise my Math score by 15 points. The AI coaching was like having a tutor in my pocket 24/7!',
              },
              {
                name: 'James Williams',
                role: 'Student',
                text: 'The practice exams were incredibly helpful. They were realistic and helped me get comfortable with the exam format.',
              },
              {
                name: 'Amara Johnson',
                role: 'Student',
                text: 'Affordable and effective. I prepared for 3 subjects at a fraction of what private tutoring would have cost.',
              },
            ].map((testimonial, i) => (
              <Card key={i} className="border-border/40">
                <CardHeader>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <span key={j} className="text-yellow-500">★</span>
                    ))}
                  </div>
                  <CardTitle className="text-lg">{testimonial.name}</CardTitle>
                  <CardDescription>{testimonial.role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground italic">&quot;{testimonial.text}&quot;</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 border-t border-border/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">
            Ready to Master Your CSEC Exams?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of Caribbean students preparing for success. Start your free account today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth">
              <Button size="lg" className="text-lg px-8 py-7 h-auto">
                Get Started for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}