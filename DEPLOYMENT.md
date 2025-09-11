# Bluesky YouTube Privacy Bot - Deployment Guide

## Overview
This bot monitors Bluesky for the `#videoprivacy` hashtag and responds with privacy-friendly video links from videoprivacy.org.

## Architecture
- **Core Logic**: TypeScript bot (`src/bot.ts`)
- **Serverless Function**: Netlify Functions (`netlify/functions/bot.ts`)
- **Scheduling**: cron-job.org (external cron service)
- **Deployment**: Netlify static site with functions

## Setup Instructions

### 1. Environment Variables
Create a `.env` file with:
```bash
BLUESKY_HANDLE=your.handle.bsky.social
BLUESKY_PASSWORD=your-app-password
HASHTAG_TO_MONITOR=#videoprivacy
PRIVACY_DOMAIN=videoprivacy.org
```

### 2. Deploy to Netlify
1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `.` (root)
4. Add environment variables in Netlify dashboard

### 3. Set up cron-job.org
1. Create account at https://cron-job.org
2. Add new cron job:
   - **URL**: `https://your-site.netlify.app/.netlify/functions/bot`
   - **Schedule**: `* * * * *` (every minute)
   - **Title**: "Bluesky Video Privacy Bot"
3. Enable the job

## Key Features
- ✅ Monitors hashtags across all Bluesky accounts
- ✅ Prevents duplicate replies using intelligent checking
- ✅ Extracts URLs only from embed data (no truncated URLs)
- ✅ Supports multiple video platforms (YouTube, TikTok, Vimeo, etc.)
- ✅ Creates clickable links with thumbnails
- ✅ Handles both regular videos and YouTube Shorts

## Local Development
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Test locally
npm run dev

# Test Netlify function locally
npm run dev:netlify
```

## Monitoring
- View logs in Netlify Functions dashboard
- Check cron-job.org execution history
- Use test files in root directory for URL validation

## File Structure
```
src/
  ├── bot.ts          # Main bot logic
  ├── utils.ts        # URL extraction utilities
  └── index.ts        # Local development entry point
netlify/
  └── functions/
      └── bot.ts       # Serverless function wrapper
test-*.js            # Testing utilities
local-scheduler.sh   # Local testing scheduler
```
