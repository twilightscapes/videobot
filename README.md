# Bluesky YouTube Privacy Bot

A bot for Bluesky that monitors posts with specific hashtags, extracts video URLs from multiple platforms, and replies with privacy-friendly alternatives using your video privacy service.

## Features

- Monitors Bluesky timeline for posts containing specified hashtags
- Supports multiple video platforms: **YouTube, TikTok, Vimeo, Twitch, Dailymotion**
- Automatically detects video URLs in posts
- Replies with privacy-friendly alternatives using your `/video?video=` URL format
- Built with TypeScript and the AT Protocol
- **Netlify-ready** for serverless deployment

## Deployment on Netlify

### 1. **Connect to Netlify**
   - Push your code to GitHub/GitLab
   - Connect the repository to Netlify
   - Netlify will automatically detect the build settings from `netlify.toml`

### 2. **Configure Environment Variables**
   In your Netlify dashboard, add these environment variables:
   ```

   ```

### 3. **Set up Scheduled Function** (Optional)
   You can trigger the bot manually via:
   ```
   https://your-site.netlify.app/.netlify/functions/bot
   ```
   
   Or set up a cron job service like **EasyCron** or **GitHub Actions** to call this endpoint regularly.

## Local Development

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Bluesky credentials:
   ```

   ```

3. **Development options**:
   ```bash
   # Test locally with Node.js
   npm run build && npm start
   
   # Test with Netlify dev environment
   npm run dev:netlify
   
   # Development with auto-reload
   npm run dev
   ```

## How it works

1. **Continuous Monitoring**: The bot checks the Bluesky timeline for new posts
2. **Multi-Platform Detection**: When it finds a post with your hashtag containing video URLs from:
   - **YouTube** (youtube.com, youtu.be, youtube.com/shorts)
   - **TikTok** (tiktok.com)
   - **Vimeo** (vimeo.com)
   - **Twitch** (twitch.tv - videos, clips, channels)
   - **Dailymotion** (dailymotion.com)
3. **Privacy Link Generation**: Creates links using your `/video?video=` format
4. **Automated Replies**: Posts replies with platform-specific emojis and privacy-friendly links

### Example Bot Reply:
```
🔒 Here's a privacy-friendly youtube link: https://your-domain.org/video?video=https%3A//youtube.com/watch%3Fv%3DdQw4w9WgXcQ 📺
```

## Deployment Options

### **Option 1: Netlify (Recommended)**
- Serverless deployment with scheduled functions
- No server maintenance required
- Free tier available

### **Option 2: Traditional Server**
- VPS or dedicated server
- Continuous monitoring (24/7)
- Requires server management

## Configuration



## Security Notes

- Never commit your `.env` file with real credentials
- Use app passwords, not your main account password
- Consider rate limits when deploying

## Development

- `npm run dev`: Start in development mode with ts-node
- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Run the compiled version

## License

MIT
