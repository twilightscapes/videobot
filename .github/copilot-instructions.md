# Bluesky YouTube Privacy Bot

This workspace contains a TypeScript bot that monitors Bluesky for hashtags and converts YouTube URLs to privacy-friendly alternatives.

## Project Status
- [x] Core bot functionality complete
- [x] Netlify Functions deployment ready
- [x] Cron-job.org scheduling setup (removed GitHub Actions)
- [x] Duplicate prevention system
- [x] URL extraction prioritizes embed data (no fallbacks to prevent truncated URLs)
- [x] Support for multiple video platforms
- [x] Documentation complete

## Setup
1. Copy `.env.example` to `.env` and configure with Bluesky credentials
2. Deploy to Netlify
3. Set up cron-job.org to hit the Netlify function URL every minute
4. Monitor logs for hashtag detection and replies
