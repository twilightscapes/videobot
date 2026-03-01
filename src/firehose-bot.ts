import { Jetstream } from '@skyware/jetstream';
import { BskyAgent, RichText } from '@atproto/api';
import * as dotenv from 'dotenv';
import express from 'express';

// Load environment variables
dotenv.config();

interface BotConfig {
  handle: string;
  password: string;
  hashtag: string;
}

class FirehoseBot {
  private agent: BskyAgent;
  private config: BotConfig;
  private processedPosts = new Map<string, number>(); // Store with timestamp
  private lastReplyTime = 0;
  private minDelayBetweenReplies = 10000; // 10 seconds between replies
  private readonly MEMORY_LIMIT = 10000; // Keep only last N posts
  private readonly POST_RETENTION_MS = 3600000; // 1 hour retention
  private activeProcessingCount = 0;
  private maxConcurrentProcessing = 2; // Limit concurrent processing to reduce memory

  constructor(config: BotConfig) {
    this.config = config;
    this.agent = new BskyAgent({ service: 'https://bsky.social' });
    this.startMemoryCleanup();
  }

  private startMemoryCleanup() {
    // Clean up old entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [postUri, timestamp] of this.processedPosts.entries()) {
        // Remove entries older than 1 hour
        if (now - timestamp > this.POST_RETENTION_MS) {
          this.processedPosts.delete(postUri);
          cleanedCount++;
        }
      }

      // Silently clean up without logging to avoid rate limit issues
      // if (cleanedCount > 0) {
      //   console.log(`🧹 Cleaned up ${cleanedCount} old post entries. Current cache size: ${this.processedPosts.size}`);
      // }

      // Also enforce size limit as backup
      if (this.processedPosts.size > this.MEMORY_LIMIT) {
        const entries = Array.from(this.processedPosts.entries()).sort((a, b) => a[1] - b[1]);
        const toDelete = entries.slice(0, entries.length - this.MEMORY_LIMIT);
        toDelete.forEach(([uri]) => this.processedPosts.delete(uri));
        // Silent cleanup
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async start() {
    // Login
    await this.agent.login({
      identifier: this.config.handle,
      password: this.config.password
    });
    console.log(`✅ Logged in as ${this.config.handle}`);

    // Start Express server for Railway health checks
    const app = express();
    const PORT = process.env.PORT || 3000;
    
    app.get('/', (req, res) => {
      res.send('Bluesky AdBlock Video Bot is running 🤖');
    });
    
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
    
    app.listen(PORT, () => {
      console.log(`🏥 Health check server running on port ${PORT}`);
    });

    // Connect to Firehose
    const jetstream = new Jetstream({
      wantedCollections: ['app.bsky.feed.post']
    });

    jetstream.on('open', () => {
      console.log('🔥 Connected to Bluesky Firehose');
    });

    jetstream.on('error', (error) => {
      console.error('❌ Firehose error:', error);
    });

    jetstream.on('close', () => {
      console.log('🔌 Firehose connection closed, reconnecting...');
      setTimeout(() => jetstream.start(), 5000);
    });

    // Listen for new posts
    jetstream.onCreate('app.bsky.feed.post', async (event) => {
      try {
        const post = event.commit.record as any;
        
        // Skip if no text
        if (!post.text) return;
        
        // Skip our own posts
        if (event.did === this.agent.session?.did) return;
        
        // Skip if already processed
        const postUri = `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`;
        if (this.processedPosts.has(postUri)) return;
        
        // Mark as processed with current timestamp
        this.processedPosts.set(postUri, Date.now());
        
        // Check for hashtag (case-insensitive) - supports both #AdBlock and #VideoPrivacy
        const postTextLower = post.text.toLowerCase();
        const hasAdBlock = postTextLower.includes('#adblock');
        const hasVideoPrivacy = postTextLower.includes('#videoprivacy');
        
        if (!hasAdBlock && !hasVideoPrivacy) return;
        
        const foundHashtag = hasAdBlock ? '#AdBlock' : '#VideoPrivacy';
        // Reduce logging - only log actual replies, not every hashtag mention
        
        // Queue post processing to limit concurrency and memory usage
        this.queuePostProcessing(postUri, post);
        
      } catch (error) {
        console.error('Error processing post:', error);
      }
    });

    jetstream.start();
    console.log('🚀 Firehose bot started, monitoring for posts...');
    
    // Handle shutdown signals
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      jetstream.close();
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      jetstream.close();
      process.exit(0);
    });
    
    // Keep the process alive indefinitely
    // This prevents the start() method from returning
    await new Promise(() => {});
  }

  private async queuePostProcessing(postUri: string, post: any) {
    // Wait if we're at max concurrent processing
    while (this.activeProcessingCount >= this.maxConcurrentProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Start processing (don't await)
    this.activeProcessingCount++;
    (async () => {
      try {
        // Fetch parent if needed
        let videoSourcePost = post;
        if (post.reply?.parent?.uri) {
          try {
            const parentThread = await this.agent.getPostThread({ uri: post.reply.parent.uri });
            if ('post' in parentThread.data.thread) {
              videoSourcePost = (parentThread.data.thread as any).post.record;
            }
          } catch (error) {
            // Use current post if parent fetch fails
          }
        }

        // Handle quoted posts (post.embed.$type === 'app.bsky.embed.record' or 'app.bsky.embed.recordWithMedia')
        if (!videoSourcePost.embed?.uri && post.embed) {
          const embedType = post.embed.$type;
          if (embedType === 'app.bsky.embed.record' || embedType === 'app.bsky.embed.recordWithMedia') {
            const quotedPostUri = post.embed.record?.uri;
            if (quotedPostUri) {
              try {
                const quotedThread = await this.agent.getPostThread({ uri: quotedPostUri });
                if ('post' in quotedThread.data.thread) {
                  videoSourcePost = (quotedThread.data.thread as any).post.record;
                }
              } catch (error) {
                // Use current post if quoted fetch fails
              }
            }
          }
        }

        // Check if already replied to this post
        const alreadyReplied = await this.hasAlreadyReplied(postUri);
        if (alreadyReplied) {
          return;
        }

        // Process: reply to postUri (the one with hashtag), but get video from videoSourcePost
        await this.processPost(postUri, videoSourcePost);
      } catch (error) {
        console.error('Error in queued processing:', error);
      } finally {
        this.activeProcessingCount--;
      }
    })();
  }

  private async hasAlreadyReplied(postUri: string): Promise<boolean> {
    try {
      const thread = await this.agent.getPostThread({ uri: postUri });
      if ('replies' in thread.data.thread && Array.isArray((thread.data.thread as any).replies)) {
        return (thread.data.thread as any).replies.some((reply: any) => 
          reply.post?.author?.did === this.agent.session?.did
        );
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private async processPost(postUri: string, post: any) {
    // Extract video URL from embed
    let videoUrl: string | null = null;
    
    if (post.embed?.external?.uri) {
      videoUrl = post.embed.external.uri;
    }
    
    if (!videoUrl) {
      return;
    }
    
    // Check if it's a YouTube URL
    if (!this.isYouTubeUrl(videoUrl)) {
      return;
    }
    
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      return;
    }
    
    // Rate limiting: wait between replies to avoid spam detection
    const now = Date.now();
    const timeSinceLastReply = now - this.lastReplyTime;
    if (timeSinceLastReply < this.minDelayBetweenReplies) {
      const waitTime = this.minDelayBetweenReplies - timeSinceLastReply;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Create privacy link
    const privacyUrl = `https://adblock.video/video?video=${videoId}`;
    
    // Reply with privacy link
    await this.replyWithPrivacyLink(postUri, privacyUrl, videoId);
    
    // Update last reply time
    this.lastReplyTime = Date.now();
  }

  private isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com|youtu\.be)/i.test(url);
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private async replyWithPrivacyLink(postUri: string, privacyUrl: string, videoId: string) {
    try {
      // Get the post thread (contains both the post and its context)
      const thread = await this.agent.getPostThread({ uri: postUri });
      const post = 'post' in thread.data.thread ? (thread.data.thread as any).post : null;
      
      if (!post) {
        console.error('❌ Could not get post data for reply');
        return;
      }
      
      const postCid = post.cid;
      
      // Determine root - if the post we're replying to has a reply.root, use that, otherwise use the post itself
      const rootUri = post.record?.reply?.root?.uri || postUri;
      const rootCid = post.record?.reply?.root?.cid || postCid;
      
      // Fetch video metadata
      const metadata = await this.fetchVideoMetadata(videoId);
      
      // Build reply text (must be under 300 characters)
      const replyText = `Here's the link you requested 👇\n\n• No dreaded 'SKIP ADS' button\n• Add to your watchlist\n• Save and watch later\n• Share custom clips and loops\n\nUse #AdBlock on any YouTube post`;
      
      // Create rich text with clickable link
      const rt = new RichText({ text: replyText });
      await rt.detectFacets(this.agent);
      
      // Get thumbnail with aggressive timeout - skip if it takes too long
      let thumbnailBlob = null;
      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)); // 5 second max
        thumbnailBlob = await Promise.race([this.fetchThumbnail(videoId), timeoutPromise]);
      } catch (error) {
        // Silently continue without thumbnail
      }
      
      // Always create embed with or without thumbnail
      const embed = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: privacyUrl,
          title: metadata?.title || 'Watch on adblock.video',
          description: metadata?.description || `Watch ad-free on adblock.video`,
          ...(thumbnailBlob && { thumb: thumbnailBlob })
        }
      };
      
      // Create reply
      await this.agent.post({
        text: rt.text,
        facets: rt.facets,
        reply: {
          root: { uri: rootUri, cid: rootCid },
          parent: { uri: postUri, cid: postCid }
        },
        embed
      });
      
      console.log(`✅ Posted reply to ${postUri.split('/').pop()}`);
      
    } catch (error) {
      console.error('Error posting reply:', error);
    }
  }

  private async getPostCid(uri: string): Promise<string> {
    const thread = await this.agent.getPostThread({ uri });
    return (thread.data.thread as any).post.cid;
  }

  private async fetchVideoMetadata(videoId: string) {
    // Try adblock.video API first
    try {
      const response = await fetch(`https://adblock.video/api/metadata?videoId=${videoId}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      // Silently fail over to YouTube
    }
    
    // Fallback to YouTube oEmbed API
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl);
      if (response.ok) {
        const data = await response.json();
        return {
          title: data.title,
          description: `By ${data.author_name}`,
          author: data.author_name
        };
      }
    } catch (error) {
      // Silently continue
    }
    
    return null;
  }

  private async fetchThumbnail(videoId: string) {
    // Try different YouTube thumbnail qualities in order of preference
    const thumbnailQualities = ['maxresdefault', 'sddefault', 'hqdefault', 'default'];
    
    // Try each quality level silently
    for (const quality of thumbnailQualities) {
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
      
      // First try custom overlay API with this quality
      try {
        const overlayUrl = `https://adblock.video/api/og-video-image?thumbnail=${encodeURIComponent(thumbnailUrl)}`;
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(overlayUrl, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'AdBlockVideoBot/1.0'
          }
        });
        clearTimeout(timeout);
        
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          
          const uploadResponse = await this.agent.uploadBlob(new Uint8Array(imageBuffer), {
            encoding: 'image/jpeg'
          });
          
          return uploadResponse.data.blob;
        }
      } catch (error) {
        // Continue to next quality
      }
      
      // Fallback to YouTube thumbnail directly for this quality
      try {
        const response = await fetch(thumbnailUrl);
        
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          
          const uploadResponse = await this.agent.uploadBlob(new Uint8Array(imageBuffer), {
            encoding: 'image/jpeg'
          });
          
          return uploadResponse.data.blob;
        }
      } catch (error) {
        // Continue to next quality
      }
    }
    return null;
  }
}

// Run the bot
async function main() {
  const config: BotConfig = {
    handle: process.env.BLUESKY_HANDLE || '',
    password: process.env.BLUESKY_PASSWORD || '',
    hashtag: process.env.HASHTAG_TO_MONITOR || '#adblock'
  };

  if (!config.handle || !config.password) {
    console.error('❌ Missing BLUESKY_HANDLE or BLUESKY_PASSWORD environment variables');
    process.exit(1);
  }

  const bot = new FirehoseBot(config);
  await bot.start();
}

main().catch(console.error);
