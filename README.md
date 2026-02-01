# CSEC Tutor - AI-Powered Exam Preparation Platform

A comprehensive web application for CSEC (Caribbean Secondary Education Certificate) exam preparation, featuring personalized lesson plans, AI-powered coaching, and practice exams based on official CSEC curriculum.

## 🚀 Features

- **Personalized Study Plans**: Create customized learning paths based on subjects and topics
- **AI-Powered Coaching**: Get fundamental explanations and learning tips from AI
- **Practice Questions**: Generate topic-specific questions based on past papers
- **Practice Exams**: Take timed exams that simulate real CSEC conditions
- **Progress Tracking**: Monitor your learning journey with detailed analytics
- **CSEC Subjects**: Support for Mathematics, English A, Biology, Chemistry, Physics, and more

## 🏗️ Architecture

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Supabase for database, authentication, and real-time features
- **AI Integration**: OpenAI GPT-4 for content generation and embeddings
- **Vector Search**: pgvector for semantic content retrieval
- **Authentication**: Supabase Auth with secure user management

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key

## 🛠️ Setup Instructions

### 1. Clone and Install

```bash
cd csec-tutor
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CSEC Tutor
```

### 3. Database Setup

1. Create a new Supabase project
2. Run the SQL schema from `database/schema.sql` in Supabase SQL editor
3. This will create all necessary tables with proper indexes and RLS policies

### 4. Start Development

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 📚 Database Schema

The application uses the following main tables:

- **users**: User profiles and authentication
- **study_plans**: Individual study plans with subjects and topics
- **csec_content**: Vectorized CSEC curriculum content and past papers
- **progress**: User progress tracking for each topic

## 🔧 Key Components

### Authentication System
- Secure sign-in/sign-up with email/password
- Protected routes and user sessions
- Profile management

### Study Plan Creation
- Subject selection from CSEC curriculum
- Topic-based learning paths
- Progress tracking

### AI Coaching
- Vector-powered content retrieval
- Personalized explanations
- CSEC-aligned examples

### Practice System
- Auto-generated questions based on curriculum
- Multiple question types (MCQ, short answer, structured)
- Instant feedback and scoring

## 🎯 User Journey

1. **Sign Up** → Create account
2. **Create Study Plan** → Choose subject and topics
3. **Fundamentals Coaching** → Learn core concepts
4. **Practice Questions** → Test understanding
5. **Practice Exam** → Final assessment
6. **Progress Review** → Track improvement

## 📖 CSEC Subjects Supported

- Mathematics
- English A
- Biology
- Chemistry
- Physics
- Principles of Business

Each subject includes:
- Official CSEC topics
- Curriculum-aligned content
- Past paper-style questions

## 🔍 Content Processing (Future Enhancement)

To populate the vector database with CSEC content:

1. Download official CSEC syllabuses and past papers
2. Process PDFs using OCR
3. Extract questions, answers, and explanations
4. Generate embeddings using OpenAI
5. Store in vector database for semantic search

## 🎨 UI Components

Built with modern React components:
- Responsive design with Tailwind CSS
- Accessible form elements
- Interactive progress indicators
- Clean, educational interface

## 🔐 Security Features

- Row Level Security (RLS) on all tables
- Secure API endpoints
- Input validation and sanitization
- Environment variable protection

## 📊 Analytics and Tracking

- Study plan completion rates
- Topic-level progress
- Practice exam scores
- Learning time analytics

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t csec-tutor .
docker run -p 3000:3000 csec-tutor
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For questions or issues:
- Check the troubleshooting guide
- Review documentation
- Contact the development team

## 🗺️ Roadmap

- [ ] Mobile app development
- [ ] Live video tutoring integration
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Offline functionality
- [ ] Study group features

## 🎓 Educational Impact

This platform aims to:
- Improve CSEC exam preparation
- Provide personalized learning experiences
- Make quality education accessible
- Support Caribbean students' success

Built with ❤️ for Caribbean students preparing for their CSEC examinations.