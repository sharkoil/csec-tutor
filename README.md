# CSEC Tutor - AI-Powered Exam Preparation Platform

An intelligent study companion for Caribbean students preparing for CSEC (Caribbean Secondary Education Certificate) examinations.

## 🎯 The Problem

Caribbean students preparing for CSEC exams face significant challenges:

- **Limited Access to Quality Tutoring**: Many students lack access to experienced tutors, especially in rural areas
- **Generic Study Resources**: Existing materials don't adapt to individual learning needs or pace
- **Outdated Practice Materials**: Finding current, curriculum-aligned practice questions is difficult
- **No Personalized Feedback**: Students often don't understand *why* they got answers wrong
- **Exam Anxiety**: Without proper preparation and practice, students enter exams underprepared

## 💡 Our Solution

CSEC Tutor uses **AI to democratize access to quality exam preparation**. By combining the official CSEC curriculum with advanced AI technology, we provide:

- **Personalized AI tutoring** that adapts to each student's needs
- **Curriculum-aligned content** pulled directly from CSEC syllabuses
- **Intelligent practice questions** that mirror actual exam formats
- **Instant, detailed feedback** that helps students learn from mistakes
- **24/7 availability** — study whenever, wherever

## 🤖 How We Use AI

### Semantic Search with Vector Embeddings
We convert CSEC syllabus content, past paper questions, and explanations into mathematical representations (embeddings) stored in a vector database. When a student asks a question or needs practice, we find the most relevant curriculum content using similarity search — ensuring every response is grounded in official CSEC material.

### AI-Powered Coaching
Using Claude (via OpenRouter), students receive:
- **Concept explanations** tailored to CSEC requirements
- **Step-by-step problem solving** with Caribbean context
- **Personalized tips** based on common student difficulties
- **Follow-up questions** to deepen understanding

### Intelligent Question Generation
The AI generates practice questions that:
- Match the style and difficulty of actual CSEC papers
- Cover specific topics the student is studying
- Include detailed marking schemes and explanations
- Adapt based on student performance

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Personalized Study Plans** | Create customized learning paths for your target subjects and topics |
| **AI Coaching Sessions** | Chat with an AI tutor that understands the CSEC curriculum |
| **Practice Questions** | Generate unlimited topic-specific questions with instant feedback |
| **Timed Practice Exams** | Simulate real CSEC exam conditions with auto-grading |
| **Progress Tracking** | Monitor improvement across topics with detailed analytics |
| **Multi-Subject Support** | Mathematics, English A, Biology, Chemistry, Physics, and more |

## 📚 Supported CSEC Subjects

- **Mathematics** — Algebra, Geometry, Statistics, Number Theory, Functions, Matrices
- **English A** — Comprehension, Essay Writing, Grammar, Summary Writing
- **Biology** — Cell Structure, Genetics, Ecology, Human Biology
- **Chemistry** — Atomic Structure, Chemical Bonding, Organic Chemistry
- **Physics** — Mechanics, Electricity, Waves, Thermal Physics
- **Principles of Business** — Business Environment, Management, Finance

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- OpenRouter API key (for AI features)
- Voyage AI API key (for embeddings — free 200M tokens/month)

### Quick Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/sharkoil/csec-tutor.git
   cd csec-tutor
   npm install
   ```

2. **Configure environment** — Copy `.env.example` to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   OPENROUTER_API_KEY=your_openrouter_key
   VOYAGE_API_KEY=your_voyage_key
   ```

3. **Set up the database** — Run the SQL in `database/schema.sql` in Supabase

4. **Populate vector database** — See [VECTOR_DATABASE_SETUP.md](VECTOR_DATABASE_SETUP.md)

5. **Start the app**
   ```bash
   npm run dev
   ```

## 📖 Documentation

- [Vector Database Setup](VECTOR_DATABASE_SETUP.md) — How to set up semantic search
- [OpenRouter Setup](OPENROUTER_SETUP.md) — Configure AI providers
- [Database Schema](database/schema.sql) — Complete database structure

## 🎓 User Journey

```
Sign Up → Create Study Plan → AI Coaching → Practice Questions → Practice Exam → Track Progress
```

1. **Create an account** and set your target exam date
2. **Build a study plan** by selecting subjects and topics
3. **Learn fundamentals** through AI-powered coaching sessions
4. **Practice with questions** that match CSEC exam style
5. **Take mock exams** under timed conditions
6. **Review progress** and focus on weak areas

## 🌍 Impact

Our goal is to **level the playing field** for Caribbean students:

- Make quality exam preparation accessible to all students, regardless of location or income
- Reduce dependency on expensive private tutoring
- Increase CSEC pass rates through better preparation
- Build student confidence through consistent practice

## 🤝 Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

**Built with ❤️ for Caribbean students preparing for CSEC examinations.**