# OpenRouter Configuration Guide

## 🔑 **Required: OpenRouter API Key**

Instead of OpenAI, we'll use **OpenRouter** which gives you access to multiple LLM models at better prices!

### 1. Get OpenRouter API Key

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up for a free account
3. Go to Dashboard → API Keys
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

### 2. Update Your .env.local

```env
# Supabase Configuration (same as before)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# NEW: OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key-here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CSEC Tutor
```

## 🤖 **OpenRouter Models We'll Use**

### **Embeddings (Vector Search)**
- **Model**: `openai/text-embedding-3-small`
- **Purpose**: Convert text to 1536-dimensional vectors
- **Cost**: ~$0.00002 per 1K tokens

### **Coaching (Detailed Explanations)**
- **Model**: `anthropic/claude-3-sonnet`
- **Purpose**: Comprehensive tutoring and explanations
- **Cost**: ~$3 per million input tokens

### **Practice Questions (Quick Generation)**
- **Model**: `anthropic/claude-3-haiku`
- **Purpose**: Generate practice questions quickly
- **Cost**: ~$0.25 per million input tokens

### **Exams (Complex Content)**
- **Model**: `anthropic/claude-3-sonnet`
- **Purpose**: Generate comprehensive practice exams
- **Cost**: ~$3 per million input tokens

## 🚀 **Benefits of OpenRouter**

### **Cost Savings**
- **~10x cheaper** than direct OpenAI API
- **Pay-per-use** model - no monthly commitments
- **Multiple models** from different providers

### **Model Choice**
- **Best model for each task**
- **Easy to switch** between providers
- **Access to latest models** instantly

### **Reliability**
- **Multiple provider backends**
- **Fallback options** if one provider is down
- **Global CDN** for fast responses

## 🔧 **Setup Commands**

### 1. Test OpenRouter Connection
```bash
npm run test-openrouter
```

This will verify:
- ✅ OpenRouter API key is valid
- ✅ Embedding generation works
- ✅ Chat completions work
- ✅ Database connection is ready

### 2. Populate Database with CSEC Content
```bash
npm run populate-db-openrouter
```

This will:
- ✅ Generate embeddings using OpenRouter
- ✅ Create CSEC content with Claude models
- ✅ Store vectors in Supabase
- ✅ Ready your AI tutoring system

## 📊 **What Gets Created**

### **Vector Database Content**
- **Mathematics**: Algebra, Geometry, Statistics
- **Biology**: Cell Structure, Genetics
- **Chemistry**: Atomic Structure, Bonding
- **Physics**: Mechanics, Forces

### **Content Types**
- **Syllabus**: Learning objectives and curriculum
- **Questions**: Practice problems with solutions
- **Explanations**: Step-by-step solutions
- **Examples**: CSEC-style worked problems

### **AI Capabilities**
- **Semantic Search**: Find relevant content by meaning
- **Personalized Coaching**: Tailored explanations
- **Question Generation**: Based on curriculum patterns
- **Exam Creation**: Comprehensive assessments

## 🎯 **Cost Estimates**

### **Initial Setup** (Populating Database)
- **Embeddings**: ~$0.10 (100 content pieces)
- **AI Generation**: ~$0.50 (questions + explanations)
- **Total Setup**: **~$0.60**

### **Monthly Usage** (100 students)
- **Embedding Searches**: ~$2.00
- **AI Coaching**: ~$10.00
- **Question Generation**: ~$5.00
- **Monthly Total**: **~$17.00**

**vs OpenAI**: Would cost ~$150+ per month!

## 🔍 **Testing Your Setup**

Once populated, test the full system:

1. **Start the app**: `npm run dev`
2. **Create study plan**: Select Mathematics + Algebra
3. **Test coaching**: Click "Start" for fundamentals
4. **Try practice**: Generate and answer questions
5. **Take exam**: Complete the learning flow

## 🆘 **Troubleshooting**

### OpenRouter Issues
```bash
# Check your API key
npm run test-openrouter

# Common problems:
# - Invalid API key
# - Insufficient credits
# - Network issues
```

### Database Issues
```bash
# Check schema was applied
# Verify Supabase connection
# Test vector search function
```

## 🎓 **Ready to Go!**

With OpenRouter configured:
- ✅ **10x cheaper** than OpenAI
- ✅ **Multiple models** for optimal performance
- ✅ **Reliable** with fallback options
- ✅ **Scalable** for student growth

Your CSEC tutor platform is now **cost-effective and powerful** with OpenRouter! 🚀