# TubeGPT Development Guide

This guide provides comprehensive instructions for setting up and developing the TubeGPT application.

## Project Overview

TubeGPT is an AI-powered application that extracts knowledge from YouTube videos by:
1. Fetching video transcripts
2. Processing transcripts with AI to generate summaries
3. Presenting insights in a user-friendly dashboard

## Quick Start

```bash
# Clone the repository (if you haven't already)
git clone <repository-url>
cd tubegpt-clean

# Install dependencies
npm install

# Setup environment variables
cp dev.env .env.local

# Start the application (Next.js + Worker)
npm run start-app
```

## Development Environment Setup

### Prerequisites

- Node.js v18+ 
- PostgreSQL database
- API keys (see below)

### Environment Variables

The application requires several environment variables to function properly. For development, copy `dev.env` to `.env.local` and update the values:

```bash
cp dev.env .env.local
```

For development without real API keys, make sure to set:

```
DEBUG_BYPASS_AUTH=true
DISABLE_REDIS=true
```

### Starting the Application

The simplest way to start both the Next.js server and worker process:

```bash
npm run start-app
```

This will:
1. Load environment variables from `.env.local`
2. Start the Next.js server on port 8000
3. Start the worker process on port 8002

### Running Components Separately

To run the Next.js server and worker separately:

```bash
# Start Next.js server
npm run dev

# In another terminal, start the worker
npm run worker
```

## Architecture

The application consists of two main components:

1. **Next.js Frontend/API**: Handles user interface, authentication, and API endpoints
2. **Worker Process**: Processes video transcripts and generates summaries

### Key Files and Directories

- `src/app/` - Next.js application routes
- `src/components/` - React components
- `src/lib/` - Shared utilities and services
- `src/worker/` - Worker process for video processing
- `start-app.js` - Unified application starter

## Testing

### Health Checks

To verify the worker is running:

```bash
curl http://localhost:8002/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": "...",
  "memoryUsage": {...},
  "environment": "development"
}
```

### Processing a Video

To test video processing:

1. Start the application with `npm run start-app`
2. Navigate to http://localhost:8000
3. Enter a YouTube URL to process

## Troubleshooting

### Common Issues

#### Worker Not Starting

If the worker fails to start:

```bash
# Check if port is already in use
netstat -ano | findstr :8002

# Kill the process if needed
taskkill /F /PID <process-id>
```

#### Redis Connection Issues

For development, set `DISABLE_REDIS=true` in `.env.local` to use in-memory processing.

#### Authentication Errors

For development, set `DEBUG_BYPASS_AUTH=true` in `.env.local` to bypass Clerk authentication.

## Production Deployment

### Build for Production

```bash
npm run build
```

### Start in Production Mode

```bash
npm run start-app
```

For Leapcell deployment, refer to `leapcell-deploy.md`.

## Database

The application uses PostgreSQL. Schema is defined in `schema.sql`.

To initialize the database:

```bash
npm run setup-db
```

## API Keys Required

- **Clerk**: Authentication (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY)
- **OpenAI**: AI processing (OPENAI_API_KEY)
- **YouTube**: Video data (YOUTUBE_API_KEY)
- **Polar**: Payment processing (POLAR_WEBHOOK_SECRET, POLAR_ACCESS_TOKEN)

For development, you can use dummy keys with `DEBUG_BYPASS_AUTH=true`.

## Performance Optimizations

- The application uses in-memory processing when Redis is unavailable
- Health checks ensure the worker is functioning properly
- Error handling prevents cascading failures

## Contributing

1. Create a feature branch
2. Make changes
3. Run tests
4. Submit a pull request

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Clerk Documentation](https://clerk.com/docs)
- [Neon Database Documentation](https://neon.tech/docs) 