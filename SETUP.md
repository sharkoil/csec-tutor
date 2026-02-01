# Quick Setup Guide

## 🚀 Get CSEC Tutor Running in 5 Minutes

### Prerequisites
- Node.js 18+
- Supabase account (free)
- OpenAI API key (optional for AI features)

### Step 1: Install Dependencies
```bash
cd csec-tutor
npm install
```

### Step 2: Set Up Supabase
1. Go to [supabase.com](https://supabase.com) and create a new project
2. In your project dashboard, go to Settings > API
3. Copy the Project URL and anon key
4. Go to the SQL Editor and run the contents of `database/schema.sql`

### Step 3: Configure Environment
1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```
3. Add OpenAI API key if you want AI features:
```env
OPENAI_API_KEY=your_openai_key
```

### Step 4: Run the App
```bash
npm run dev
```

Visit `http://localhost:3000` - your CSEC Tutor is ready!

## 🎯 Test the Application

1. **Create Account** → Test authentication
2. **Create Study Plan** → Pick Mathematics and a few topics
3. **Try Coaching** → Generate fundamental content
4. **Practice Questions** → Test the quiz system
5. **Take Exam** → Complete the learning flow

## 🛠️ Troubleshooting

### Database Issues
- Make sure you ran the SQL schema in Supabase
- Check that RLS policies are enabled
- Verify your API keys are correct

### Authentication Issues
- Confirm your Supabase URL is correct
- Check that auth is enabled in Supabase
- Verify email/password combination

### AI Features Not Working
- Ensure OpenAI API key is valid
- Check your API usage limits
- Verify the key is in `.env.local`

### Build Errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Check TypeScript
npm run build
```

## 📱 Development Workflow

### File Structure
```
csec-tutor/
├── app/                 # Next.js pages and layouts
├── components/           # React components
├── lib/                # Utilities and database logic
├── types/              # TypeScript definitions
├── data/               # Static data (subjects, topics)
└── database/           # SQL schema
```

### Adding New Features
1. Create components in `components/`
2. Add types in `types/`
3. Update database schema if needed
4. Test with `npm run dev`

## 🚀 Going to Production

### Vercel Deployment (Recommended)
1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Manual Deployment
```bash
npm run build
npm start
```

## 🎓 Success!

You now have a fully functional CSEC exam preparation platform with:
- ✅ User authentication
- ✅ Study plan creation
- ✅ AI-powered coaching
- ✅ Practice questions
- ✅ Exam simulation
- ✅ Progress tracking

## 📞 Need Help?

- Check the full README.md for detailed documentation
- Review the database schema in `database/schema.sql`
- Examine existing components for patterns
- Test each feature step by step

Happy teaching and learning! 🎓