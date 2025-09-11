export interface VideoUrlInfo {
  url: string;
  platform: string;
  id: string;
  type?: string; // for twitch clips vs videos vs channels
}

export interface YouTubeUrlInfo {
  url: string;
  videoId: string;
  isShort: boolean;
}

export class URLUtils {
  /**
   * Extract video URL info from text for multiple platforms
   */
  static extractVideoInfo(text: string): VideoUrlInfo | null {
    // YouTube - Enhanced patterns to capture full URLs
    const youtubePatterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{4,})(?:\S*)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{4,})(?:\S*)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{4,})(?:\S*)/
    ];

    for (const pattern of youtubePatterns) {
      const match = text.match(pattern);
      if (match) {
        let fullUrl = match[0];
        // Ensure URL has protocol
        if (!fullUrl.startsWith('http')) {
          fullUrl = 'https://' + fullUrl;
        }
        return {
          url: fullUrl,
          platform: 'youtube',
          id: match[1],
          type: match[0].includes('/shorts/') ? 'short' : 'video'
        };
      }
    }

    // Vimeo
    const vimeoMatch = text.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)(?:\S*)/);
    if (vimeoMatch) {
      let fullUrl = vimeoMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
        platform: 'vimeo',
        id: vimeoMatch[1]
      };
    }

    // TikTok - Multiple patterns for different URL formats
    const tiktokPatterns = [
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/.*\/video\/(\d+)(?:\S*)/,           // Standard format
      /(?:https?:\/\/)?vm\.tiktok\.com\/([a-zA-Z0-9]+)(?:\/)?(?:\S*)/,          // Short vm.tiktok.com
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([a-zA-Z0-9]+)(?:\/)?(?:\S*)/,   // Short tiktok.com/t/
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)(?:\S*)/     // @username format
    ];

    for (const pattern of tiktokPatterns) {
      const match = text.match(pattern);
      if (match) {
        let fullUrl = match[0];
        if (!fullUrl.startsWith('http')) {
          fullUrl = 'https://' + fullUrl;
        }
        return {
          url: fullUrl,
          platform: 'tiktok',
          id: match[1]
        };
      }
    }

    // Twitch
    const twitchVideoMatch = text.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/videos\/(\d+)(?:\S*)/);
    if (twitchVideoMatch) {
      let fullUrl = twitchVideoMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
        platform: 'twitch',
        id: twitchVideoMatch[1],
        type: 'video'
      };
    }

    const twitchClipMatch = text.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/\w+\/clip\/(\w+)|(?:https?:\/\/)?clips\.twitch\.tv\/(\w+)(?:\S*)/);
    if (twitchClipMatch) {
      const clipId = twitchClipMatch[1] || twitchClipMatch[2];
      let fullUrl = twitchClipMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
        platform: 'twitch',
        id: clipId,
        type: 'clip'
      };
    }

    // Dailymotion
    const dailymotionMatch = text.match(/(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/video\/([a-zA-Z0-9]+)(?:\S*)/);
    if (dailymotionMatch) {
      let fullUrl = dailymotionMatch[0];
      if (!fullUrl.startsWith('http')) {
        fullUrl = 'https://' + fullUrl;
      }
      return {
        url: fullUrl,
        platform: 'dailymotion',
        id: dailymotionMatch[1]
      };
    }

    return null;
  }

  /**
   * Extract YouTube URL and additional info from text (legacy method for backward compatibility)
   */
  static extractYouTubeInfo(text: string): YouTubeUrlInfo | null {
    const videoInfo = this.extractVideoInfo(text);
    if (videoInfo && videoInfo.platform === 'youtube') {
      return {
        url: videoInfo.url,
        videoId: videoInfo.id,
        isShort: videoInfo.type === 'short'
      };
    }
    return null;
  }

  /**
   * Generate privacy-friendly URL with video info or full URL
   */
  static async createPrivacyUrl(videoInfoOrUrl: VideoUrlInfo | string, privacyDomain: string): Promise<string> {
    let videoInfo: VideoUrlInfo | null;
    
    if (typeof videoInfoOrUrl === 'string') {
      // If passed a string, extract video info from it
      videoInfo = this.extractVideoInfo(videoInfoOrUrl);
    } else {
      // If passed a VideoUrlInfo object, use it directly
      videoInfo = videoInfoOrUrl;
    }
    
    if (videoInfo) {
      // For TikTok short URLs, resolve redirects to get the actual video URL
      if (videoInfo.platform === 'tiktok' && (
          videoInfo.url.includes('/t/') || 
          videoInfo.url.includes('vm.tiktok.com')
      )) {
        try {
          const resolvedUrl = await this.resolveRedirect(videoInfo.url);
          if (resolvedUrl) {
            // Extract video info from the resolved URL to get the proper video ID
            const resolvedVideoInfo = this.extractVideoInfo(resolvedUrl);
            if (resolvedVideoInfo) {
              videoInfo = resolvedVideoInfo;
            }
          }
        } catch (error) {
          console.error('Failed to resolve TikTok redirect:', error);
          // Fall back to original URL
        }
      }
      
      // For YouTube, use just the video ID
      if (videoInfo.platform === 'youtube') {
        return `https://${privacyDomain}/video?video=${videoInfo.id}`;
      }
      // For all other platforms, use the full URL
      return `https://${privacyDomain}/video?video=${encodeURIComponent(videoInfo.url)}`;
    }
    
    // Fallback: if extraction fails and we have a string URL, use it directly
    const url = typeof videoInfoOrUrl === 'string' ? videoInfoOrUrl : '';
    return `https://${privacyDomain}/video?video=${encodeURIComponent(url)}`;
  }

  /**
   * Resolve URL redirects to get the final destination URL
   */
  static async resolveRedirect(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow'
      });
      
      // Return the final URL after following redirects
      return response.url;
    } catch (error) {
      console.error('Error resolving redirect:', error);
      return null;
    }
  }

  /**
   * Validate if a URL is a valid YouTube URL
   */
  static isValidYouTubeUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'youtube.com' || 
             urlObj.hostname === 'www.youtube.com' || 
             urlObj.hostname === 'youtu.be';
    } catch {
      return false;
    }
  }
}
