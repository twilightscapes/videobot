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

  constructor(config: BotConfig) {
    this.agent = new BskyAgent({
      service: 'https://bsky.social'
    });
    this.config = config;
  }

  private async hasAlreadyReplied(postUri: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking replies for: ${postUri}`);
      
      // Get the post thread to see if we've already replied
      const threadResponse = await this.agent.app.bsky.feed.getPostThread({
        uri: postUri,
        depth: 1
      });

      console.log(`📡 Thread response received for: ${postUri}`);

      if (threadResponse.data.thread && 'replies' in threadResponse.data.thread) {
        const replies = (threadResponse.data.thread as any).replies || [];
        console.log(`💬 Found ${replies.length} replies to check`);
        
        // Check if any reply is from our bot account
        for (let i = 0; i < replies.length; i++) {
          const reply = replies[i];
          if (reply.post && reply.post.author && reply.post.author.handle) {
            const replyAuthor = reply.post.author.handle;
            console.log(`👤 Reply ${i + 1} from: ${replyAuthor}`);
            
            if (replyAuthor === this.config.handle) {
              console.log(`✅ FOUND existing reply from bot (${this.config.handle}) to: ${postUri}`);
              return true;
            }
          }
        }
        
        console.log(`❌ NO existing replies from bot (${this.config.handle}) found`);
      } else {
        console.log(`📭 No replies found for post: ${postUri}`);
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Error checking replies for ${postUri}:`, error);
      console.log(`🤷 Assuming not replied due to error`);
      return false;
    }
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
      console.log(`🔍 Search query: "${this.config.hashtag}"`);
      
      const response = await this.agent.app.bsky.feed.searchPosts({
        q: this.config.hashtag,
        limit: 25,
        sort: 'latest' // Get the most recent posts
      });

      console.log(`📊 Found ${response.data.posts.length} posts with hashtag`);
      console.log(`📊 Full search response:`, JSON.stringify(response.data, null, 2));

      let processedCount = 0;
      for (const post of response.data.posts) {
        console.log(`\n🔄 === Processing Post ${processedCount + 1}/${response.data.posts.length} ===`);
        console.log(`📍 Post URI: ${post.uri}`);
        console.log(`👤 Post Author: ${post.author.handle} (${post.author.displayName})`);
        
        if (post.record && typeof post.record === 'object' && 'text' in post.record) {
          const text = post.record.text as string;
          const postDate = new Date((post.record as any).createdAt);
          
          console.log(`📝 Post text: "${text}"`);
          console.log(`� Post date: ${postDate.toISOString()}`);
          console.log(`🏷️ Contains hashtag "${this.config.hashtag}": ${text.includes(this.config.hashtag)}`);
          
          // Log if this is a reply/comment
          if ((post.record as any).reply) {
            const replyInfo = (post.record as any).reply;
            console.log(`� This is a COMMENT replying to: ${replyInfo.parent?.uri || replyInfo.root?.uri}`);
          } else {
            console.log(`📄 This is a REGULAR POST (not a comment)`);
          }
          
          // Check if post contains our hashtag and we haven't already replied
          if (text.includes(this.config.hashtag)) {
            // Always check if we've replied to THIS specific post (not parent)
            const targetPostUri = post.uri;
            console.log(`🎯 Checking if we've replied to: ${targetPostUri}`);
            
            const alreadyReplied = await this.hasAlreadyReplied(targetPostUri);
            console.log(`🤔 Already replied? ${alreadyReplied}`);
            
            if (!alreadyReplied) {
              console.log(`✅ Processing NEW post with hashtag: ${text.substring(0, 100)}...`);
              
              // Check if this is a reply/comment
              if ((post.record as any).reply) {
                console.log(`🔄 Calling processComment...`);
                await this.processComment(post, text);
              } else {
                console.log(`🔄 Calling processPost...`);
                // This is a regular post with hashtag, check for video URLs in the same post
                await this.processPost(post, text);
              }
              
              processedCount++;
            } else {
              console.log(`⏭️ SKIPPING post (already replied)`);
            }
          } else {
            console.log(`⏭️ SKIPPING post (no hashtag found)`);
          }
        } else {
          console.log(`❌ SKIPPING post (no text content)`);
        }
      }
      
      console.log(`🏁 SUMMARY: Processed ${processedCount} new posts out of ${response.data.posts.length} total`);
      
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
          
          // Check if post contains our hashtag and we haven't replied yet
          if (text.includes(this.config.hashtag)) {
            const alreadyReplied = await this.hasAlreadyReplied(item.post.uri);
            if (!alreadyReplied) {
              console.log(`Found new post with hashtag: ${text.substring(0, 100)}...`);
              await this.processPost(item.post, text);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  }

  private async processPost(post: any, text: string): Promise<void> {
    console.log(`🔍 Processing post for video URLs: ${text.substring(0, 200)}`);
    
    // First, prioritize embed/card data (which has complete URLs)
    let videoInfo = null;
    
    if (post.embed) {
      const embed = post.embed;
      console.log(`🔗 Found embed data:`, JSON.stringify(embed, null, 2));
      
      // Check if it's an external embed with a URI (this is where complete URLs live)
      if (embed.external && embed.external.uri) {
        const embedUri = embed.external.uri;
        console.log(`🌐 Found embed URI: ${embedUri}`);
        videoInfo = URLUtils.extractVideoInfo(embedUri);
      }
    }
    
    // If no video found in embed, check facets (link annotations)
    if (!videoInfo && post.record && post.record.facets) {
      const facets = post.record.facets;
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
    
    // Only as a last resort, try extracting from text (which may be truncated)
    if (!videoInfo) {
      console.log(`🔤 No video found in embed/facets, trying text extraction (may be truncated)`);
      videoInfo = URLUtils.extractVideoInfo(text);
    }
    
    if (videoInfo) {
      console.log(`✅ Found ${videoInfo.platform} URL: ${videoInfo.url} (${videoInfo.type || 'video'})`);
      await this.replyWithPrivacyLink(post, videoInfo);
    } else {
      console.log(`❌ No video URLs found in post (embed, facets, or text)`);
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
          // Reply to the commenter who requested it, not the original post
          await this.replyWithPrivacyLink(commentPost, videoInfo);
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

  private async replyWithPrivacyLink(originalPost: any, videoInfo: VideoUrlInfo): Promise<void> {
    try {
      console.log(`🚀 Creating privacy link for ${videoInfo.platform} URL: ${videoInfo.url}`);
      const privacyUrl = URLUtils.createPrivacyUrl(videoInfo.url, this.config.privacyDomain);
      
      // Short prefix with URL on new line
      const replyText = `Privacy link:\n${privacyUrl}`;
      
      console.log(`💬 Posting reply: ${replyText}`);
      console.log(`📍 Replying to: ${originalPost.uri}`);
      
      // Calculate facets to make the URL clickable
      const urlStart = replyText.indexOf(privacyUrl);
      const urlByteStart = Buffer.byteLength(replyText.substring(0, urlStart), 'utf8');
      const urlByteEnd = urlByteStart + Buffer.byteLength(privacyUrl, 'utf8');
      
      const facets = [
        {
          index: {
            byteStart: urlByteStart,
            byteEnd: urlByteEnd
          },
          features: [
            {
              $type: 'app.bsky.richtext.facet#link',
              uri: privacyUrl
            }
          ]
        }
      ];
      
      console.log(`🔗 URL facet: ${urlByteStart}-${urlByteEnd} for "${privacyUrl}"`);
      
      // Determine reply structure based on whether this is a comment or original post
      let replyStructure: any;
      
      if (originalPost.record && originalPost.record.reply) {
        // This is a comment - reply to the commenter but maintain thread structure
        const commentReplyInfo = originalPost.record.reply;
        console.log(`💬 Replying to commenter in thread`);
        
        replyStructure = {
          root: {
            uri: commentReplyInfo.root.uri,
            cid: commentReplyInfo.root.cid
          },
          parent: {
            uri: originalPost.uri,
            cid: originalPost.cid
          }
        };
      } else {
        // This is an original post - reply to it directly
        console.log(`📄 Replying to original post`);
        
        replyStructure = {
          root: {
            uri: originalPost.uri,
            cid: originalPost.cid
          },
          parent: {
            uri: originalPost.uri,
            cid: originalPost.cid
          }
        };
      }
      
      // Create external embed with uploaded thumbnail
      let embed: any = {
        $type: 'app.bsky.embed.external',
        external: {
          uri: privacyUrl,
          title: `Privacy-friendly ${videoInfo.platform} link`,
          description: `Watch this video without tracking or data collection`
        }
      };
      
      // Try to upload thumbnail for YouTube videos
      if (videoInfo.platform === 'youtube') {
        try {
          const thumbnailUrl = `https://img.youtube.com/vi/${videoInfo.id}/hqdefault.jpg`;
          console.log(`🖼️ Fetching thumbnail: ${thumbnailUrl}`);
          
          const response = await fetch(thumbnailUrl);
          if (response.ok) {
            const imageBuffer = await response.arrayBuffer();
            const blob = await this.agent.uploadBlob(new Uint8Array(imageBuffer), {
              encoding: 'image/jpeg'
            });
            
            embed.external.thumb = blob.data.blob;
            console.log(`✅ Uploaded thumbnail as blob`);
          }
        } catch (error) {
          console.log(`❌ Failed to upload thumbnail, continuing without: ${error}`);
        }
      }
      
      console.log(`📦 Embed structure:`, JSON.stringify(embed, null, 2));
      
      await this.agent.post({
        text: replyText,
        facets: facets,
        embed: embed,
        reply: replyStructure
      });
      
      console.log(`✅ Successfully replied with privacy link: ${privacyUrl}`);
    } catch (error) {
      console.error('❌ Error posting reply:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    }
  }
}
