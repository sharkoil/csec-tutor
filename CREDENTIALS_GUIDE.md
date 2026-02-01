# 📋 Your Supabase Credentials

Copy these from your Supabase project dashboard:

## Supabase Project Settings
Go to: https://supabase.com/dashboard → Your Project → Settings → API

### Project URL:
https://[YOUR-PROJECT-ID].supabase.co

### API Keys:
- **anon/public key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- **service_role key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

## OpenAI API Key
Go to: https://platform.openai.com → API keys

### API Key:
sk-Your-Actual-API-Key-Here...

## Fill in your .env.local:

```env
# Copy this exact structure
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
OPENAI_API_KEY=sk-your-openai-key-here
```

Once you have these, run:
```bash
npm run populate-db
```