import { BskyAgent } from '@atproto/api';
import WebSocket from 'ws';
import { URLUtils, VideoUrlInfo } from './utils';

export interface BotConfig {
  handle: string;
  password: string;
  hashtag: string;
  privacyDomain: string;
}

export class BskyBot {
  private agent: BskyAgent;
  private config: BotConfig;
  private processedPosts = new Set<string>();

  constructor(config: BotConfig) {
    this.config = config;
    this.agent = new BskyAgent({
      service: 'https://bsky.social'
    });
  }

  async start(): Promise<void> {
    console.log(`Logging in as ${this.config.handle}...`);
    
    try {
      await this.agent.login({
        identifier: this.config.handle,
        password: this.config.password
      });
      
      console.log('Successfully logged in to Bluesky');
      console.log(`Monitoring for hashtag: ${this.config.hashtag}`);
      
      await this.startMonitoring();
    } catch (error) {
      console.error('Failed to login:', error);
      throw error;
    }
  }

  async runSingleCheck(): Promise<void> {
    console.log(`Running single check as ${this.config.handle}...`);
    
    try {
      await this.agent.login({
        identifier: this.config.handle,
        password: this.config.password
      });
      
      console.log('Successfully logged in to Bluesky');
      console.log(`Checking for hashtag: ${this.config.hashtag}`);
      
      // Run a single timeline check
      await this.checkTimeline();
      console.log('Single check completed');
    } catch (error) {
      console.error('Failed during single check:', error);
      throw error;
    }
  }

  private async startMonitoring(): Promise<void> {
    // For now, we'll use a simple polling approach
    // In a production bot, you'd want to use the firehose WebSocket
    console.log('Starting to monitor timeline...');
    
    setInterval(async () => {
      try {
        await this.checkTimeline();
      } catch (error) {
        console.error('Error checking timeline:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private async checkTimeline(): Promise<void> {
    try {
      // Try search first, but with better error handling
      console.log(`🔍 Searching for posts with hashtag: ${this.config.hashtag}`);
      
      const response = await this.agent.app.bsky.feed.searchPosts({
        q: this.config.hashtag,
        limit: 25,
        sort: 'latest' // Get the most recent posts
      });

      console.log(`📊 Found ${response.data.posts.length} posts with hashtag`);

      let processedCount = 0;
      for (const post of response.data.posts) {
        if (post.record && typeof post.record === 'object' && 'text' in post.record) {
          const text = post.record.text as string;
          
          console.log(`📝 Checking post: ${text.substring(0, 150)}`);
          console.log(`🔗 Post URI: ${post.uri}`);
          console.log(`🏷️ Contains hashtag: ${text.includes(this.config.hashtag)}`);
          console.log(`✅ Already processed: ${this.processedPosts.has(post.uri)}`);
          
          // Check if post contains our hashtag and hasn't been processed
          if (text.includes(this.config.hashtag) && !this.processedPosts.has(post.uri)) {
            console.log(`🎯 Processing new post with hashtag: ${text.substring(0, 100)}...`);
            
            // Check if this is a reply/comment
            if ((post.record as any).reply) {
              console.log(`💬 This is a comment, checking parent post for video URLs...`);
              await this.processComment(post, text);
            } else {
              // This is a regular post with hashtag, check for video URLs in the same post
              console.log(`📄 This is a regular post, checking for video URLs...`);
              await this.processPost(post, text);
            }
            
            this.processedPosts.add(post.uri);
            processedCount++;
          } else {
            console.log(`⏭️ Skipping post (already processed or no hashtag match)`);
          }
        } else {
          console.log(`❌ Skipping post (no text content)`);
        }
      }
      
      console.log(`🏁 Processed ${processedCount} new posts`);
      
    } catch (error) {
      console.error('❌ Error searching for posts:', error);
      console.log('🔄 Falling back to timeline check...');
      await this.checkTimelineFallback();
    }
  }

  private async checkTimelineFallback(): Promise<void> {
    try {
      console.log('Falling back to timeline check...');
      const response = await this.agent.getTimeline({
        algorithm: 'reverse-chronological',
        limit: 20
      });

      for (const item of response.data.feed) {
        if (item.post.record && typeof item.post.record === 'object' && 'text' in item.post.record) {
          const text = item.post.record.text as string;
          
          // Check if post contains our hashtag and hasn't been processed
          if (text.includes(this.config.hashtag) && !this.processedPosts.has(item.post.uri)) {
            console.log(`Found post with hashtag: ${text.substring(0, 100)}...`);
            await this.processPost(item.post, text);
            this.processedPosts.add(item.post.uri);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  }

  private async processPost(post: any, text: string): Promise<void> {
    console.log(`🔍 Processing post for video URLs: ${text.substring(0, 200)}`);
    const videoInfo = URLUtils.extractVideoInfo(text);
    
    if (videoInfo) {
      console.log(`✅ Found ${videoInfo.platform} URL: ${videoInfo.url} (${videoInfo.type || 'video'})`);
      await this.replyWithPrivacyLink(post, videoInfo);
    } else {
      console.log(`❌ No video URLs found in post`);
    }
  }

  private async processComment(commentPost: any, commentText: string): Promise<void> {
    try {
      console.log(`💭 Processing comment: ${commentText}`);
      
      // Get the parent post that this comment is replying to
      const replyInfo = (commentPost.record as any).reply;
      const parentUri = replyInfo.parent.uri || replyInfo.root.uri;
      
      console.log(`📍 Getting parent post: ${parentUri}`);
      
      // Fetch the parent post using the correct API
      const parentResponse = await this.agent.app.bsky.feed.getPostThread({
        uri: parentUri,
        depth: 0
      });
      
      console.log(`📡 Parent response type: ${typeof parentResponse}`);
      
      if (parentResponse && parentResponse.data && parentResponse.data.thread) {
        const parentPost = parentResponse.data.thread.post as any;
        console.log(`🔍 Parent post structure:`, JSON.stringify(parentPost, null, 2));
        
        // Get parent post text if it exists
        let parentText = '';
        if (parentPost && parentPost.record && parentPost.record.text) {
          parentText = parentPost.record.text;
          console.log(`📝 Parent post text: "${parentText}"`);
        }
        
        // First try to find video URLs in the text
        let videoInfo = URLUtils.extractVideoInfo(parentText);
        
        // If no video found in text, check for embed/card data
        if (!videoInfo && parentPost.embed) {
          const embed = parentPost.embed;
          console.log(`🔗 Found embed data:`, JSON.stringify(embed, null, 2));
          
          // Check if it's an external embed with a URI
          if (embed.external && embed.external.uri) {
            const embedUri = embed.external.uri;
            console.log(`🌐 Found embed URI: ${embedUri}`);
            videoInfo = URLUtils.extractVideoInfo(embedUri);
          }
        }
        
        // Also check for any URLs in facets (link annotations)
        if (!videoInfo && parentPost.record && parentPost.record.facets) {
          const facets = parentPost.record.facets;
          console.log(`🔗 Found facets:`, JSON.stringify(facets, null, 2));
          
          for (const facet of facets || []) {
            for (const feature of facet.features || []) {
              if (feature.$type === 'app.bsky.richtext.facet#link' && feature.uri) {
                console.log(`🌐 Found facet URI: ${feature.uri}`);
                videoInfo = URLUtils.extractVideoInfo(feature.uri);
                if (videoInfo) break;
              }
            }
            if (videoInfo) break;
          }
        }
        
        if (videoInfo) {
          console.log(`✅ Found ${videoInfo.platform} URL in parent post: ${videoInfo.url}`);
          // Reply to the original video post, but with proper threading
          await this.replyWithPrivacyLink(commentPost, videoInfo, parentPost);
        } else {
          console.log(`❌ No video URLs found in parent post (text, embed, or facets)`);
        }
      } else {
        console.log(`❌ Could not retrieve parent post thread`);
      }
    } catch (error) {
      console.error(`❌ Error processing comment:`, error);
    }
  }

  private extractYouTubeURL(text: string): string | null {
    const info = URLUtils.extractVideoInfo(text);
    return info && info.platform === 'youtube' ? info.url : null;
  }

  private async replyWithPrivacyLink(originalPost: any, videoInfo: VideoUrlInfo, rootPost?: any): Promise<void> {
    try {
      console.log(`🚀 Creating privacy link for ${videoInfo.platform} URL: ${videoInfo.url}`);
      const privacyUrl = URLUtils.createPrivacyUrl(videoInfo.url, this.config.privacyDomain);
      
      const replyText = `Here's a privacy-friendly ${videoInfo.platform} link: ${privacyUrl}`;
      
      console.log(`💬 Posting reply: ${replyText}`);
      console.log(`📍 Replying to post: ${originalPost.uri}`);
      
      // Create facets to make the URL a clickable link card
      const facets = [
        {
          index: {
            byteStart: replyText.indexOf(privacyUrl),
            byteEnd: replyText.indexOf(privacyUrl) + privacyUrl.length
          },
          features: [
            {
              $type: 'app.bsky.richtext.facet#link',
              uri: privacyUrl
            }
          ]
        }
      ];
      
      // If we have a root post (video post), reply to it directly so it shows in main thread
      // Otherwise reply to the original post
      const targetPost = rootPost || originalPost;
      
      await this.agent.post({
        text: replyText,
        facets: facets,
        reply: {
          root: {
            uri: targetPost.uri,
            cid: targetPost.cid
          },
          parent: {
            uri: targetPost.uri,
            cid: targetPost.cid
          }
        }
      });
      
      console.log(`✅ Successfully replied with privacy link: ${privacyUrl}`);
    } catch (error) {
      console.error('❌ Error posting reply:', error);
    }
  }
}
