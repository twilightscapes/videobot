# Bluesky Video Privacy Bot

A bot for Bluesky that monitors posts with specific hashtags, extracts video URLs from multiple platforms, and replies with privacy-friendly alternatives using your video privacy service.

## 🎯 Features

- **Multi-Platform Support**: YouTube, TikTok, Vimeo, Twitch, Dailymotion
- **Hashtag Monitoring**: Automatically detects posts with specified hashtags
- **Privacy Links**: Converts video URLs to privacy-friendly alternatives
- **Smart Caching**: Prevents duplicate replies
- **TypeScript**: Fully typed for better development experience
- **Netlify-Ready**: Deploy as a serverless function

## 🚀 Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   BLUESKY_HANDLE=your-bot.bsky.social
   BLUESKY_PASSWORD=your-app-password
   HASHTAG_TO_MONITOR=#videoprivacy
   PRIVACY_DOMAIN=your-domain.org
   ```

3. **Run locally**:
   ```bash
   # Build and run
   npm run build && npm start
   
   # Development mode with auto-reload
   npm run dev
   
   # Test with Netlify environment
   npm run dev:netlify
   ```

## 🌐 Deployment on Netlify

### Setup

1. **Push to Git** (GitHub/GitLab)
2. **Connect to Netlify** (auto-detects build settings)
3. **Add Environment Variables** in Netlify dashboard:
   - `BLUESKY_HANDLE`
   - `BLUESKY_PASSWORD`
   - `HASHTAG_TO_MONITOR`
   - `PRIVACY_DOMAIN`

### Scheduled Function

Set up a cron service (like [cron-job.org](https://cron-job.org)) to call:
```
https://your-site.netlify.app/.netlify/functions/bot
```

Schedule: `* * * * *` (every minute)

## 📋 How It Works

1. **Monitors** Bluesky timeline for posts with your hashtag
2. **Detects** video URLs from supported platforms:
   - YouTube (youtube.com, youtu.be, /shorts)
   - TikTok (all formats including short links)
   - Vimeo
   - Twitch (videos, clips, channels)
   - Dailymotion
3. **Generates** privacy-friendly links using your domain
4. **Replies** automatically with the privacy link

### Example Reply:
```
The Video Privacy Link You Requested:
https://your-domain.org/video?video=https%3A//youtube.com/watch%3Fv%3DdQw4w9WgXcQ
```

## 🛠️ Development

### Available Scripts

```bash
npm run build          # Compile TypeScript
npm start              # Run compiled version
npm run dev            # Development mode
npm run lint           # Check code quality
npm run lint:fix       # Fix linting issues
npm run format         # Format code with Prettier
npm run test           # Run tests
npm run clean          # Remove build artifacts
```

### Project Structure

```
videobot/
├── src/
│   ├── bot.ts         # Main bot logic
│   ├── index.ts       # Entry point
│   └── utils.ts       # URL utilities
├── tests/             # Test files
├── netlify/
│   └── functions/     # Netlify function handlers
├── dist/              # Compiled output (gitignored)
└── .env               # Local config (gitignored)
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BLUESKY_HANDLE` | Your bot's Bluesky handle | Required |
| `BLUESKY_PASSWORD` | App password (not main password) | Required |
| `HASHTAG_TO_MONITOR` | Hashtag to monitor | `#videoprivacy` |
| `PRIVACY_DOMAIN` | Your privacy service domain | `your-domain.org` |

### Bot Settings

Edit constants in `src/bot.ts`:
- `CACHE_SIZE`: Processed posts cache size (default: 100)
- `MAX_AGE_HOURS`: Maximum post age to process (default: 24)
- `CHECK_INTERVAL_MS`: Polling interval (default: 30000)

## 🔒 Security

- ✅ Never commit `.env` files
- ✅ Use app passwords, not main account password
- ✅ Review rate limits before deploying
- ✅ Keep dependencies updated

## 📦 Supported Platforms

### YouTube
- Standard videos: `youtube.com/watch?v=`
- Short links: `youtu.be/`
- Shorts: `youtube.com/shorts/`

### TikTok
- Standard: `tiktok.com/@user/video/`
- Short links: `vm.tiktok.com/` and `tiktok.com/t/`

### Vimeo
- All formats: `vimeo.com/[id]`

### Twitch
- Videos: `twitch.tv/videos/[id]`
- Clips: `twitch.tv/[user]/clip/` or `clips.twitch.tv/`
- Channels: `twitch.tv/[username]`

### Dailymotion
- Videos: `dailymotion.com/video/[id]`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run format`
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🐛 Troubleshooting

### Bot not responding?
- Check environment variables are set correctly
- Verify bot account credentials
- Check Netlify function logs
- Ensure cron job is active

### Rate limit errors?
- Reduce `CHECK_INTERVAL_MS`
- Lower search result `limit`
- Check Bluesky API rate limits

### Can't find posts?
- Verify hashtag spelling (case-insensitive)
- Check `MAX_AGE_HOURS` setting
- Test with recent posts manually

## 📚 Resources

- [Bluesky AT Protocol Docs](https://atproto.com)
- [Netlify Functions Guide](https://docs.netlify.com/functions/overview/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
