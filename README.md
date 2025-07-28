# TA Portal - Automated Grading System

A Next.js application for TAs to create assignments, generate rubrics using GPT, and auto-grade student submissions.

## Features

- **Google OAuth Login** (restricted to @berkeley.edu emails)
- **Assignment Creation** with prompt and solution image uploads
- **AI-Powered Rubric Generation** using GPT-4 Vision
- **Student Submission Management** with multi-page uploads
- **Auto-Grading** with detailed feedback using GPT

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth
- **AI**: OpenAI GPT-4 Vision for rubric generation and grading

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables** in `.env.local`:
   ```
   DATABASE_URL="postgresql://username@localhost:5432/ta_portal_db"
   GOOGLE_CLIENT_ID="your_google_client_id"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"
   NEXTAUTH_SECRET="your_nextauth_secret"
   NEXTAUTH_URL="http://localhost:3001"
   OPENAI_API_KEY="your_openai_api_key"
   ```

3. **Set up database**:
   ```bash
   createdb ta_portal_db
   npx prisma db push
   ```

4. **Run development server**:
```bash
npm run dev
   ```

5. **Access the app**: http://localhost:3001

## Deployment

### Option 1: Vercel + Railway (Recommended)

1. **Deploy to Vercel**:
   - Connect your GitHub repository
   - Add environment variables in Vercel dashboard
   - Deploy

2. **Set up Railway database**:
   - Create PostgreSQL database on Railway
   - Update `DATABASE_URL` in Vercel environment variables
   - Run `npx prisma db push` with Railway database URL

3. **Update Google OAuth**:
   - Add Vercel domain to authorized redirect URIs
   - Update `NEXTAUTH_URL` to your Vercel domain

### Option 2: Railway Full Stack

1. **Deploy to Railway**:
   - Import GitHub repository
   - Add PostgreSQL database
   - Set environment variables
   - Deploy

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | Yes |
| `NEXTAUTH_URL` | Your app's base URL | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |

## Database Schema

- **User**: NextAuth.js user accounts
- **TAProfile**: TA-specific profile data
- **Assignment**: Assignment metadata and prompt images
- **Solution**: Solution images for assignments
- **SubmissionGroup**: Student submission groups
- **SubmissionPage**: Individual submission pages

## API Endpoints

- `POST /api/assignments` - Create new assignment
- `GET /api/assignments` - List assignments
- `POST /api/assignments/[id]/rubric/generate` - Generate rubric with GPT
- `PUT /api/assignments/[id]/rubric` - Save rubric
- `POST /api/assignments/[id]/submissions` - Upload student submission
- `POST /api/submissions/[id]/grade` - Auto-grade submission
