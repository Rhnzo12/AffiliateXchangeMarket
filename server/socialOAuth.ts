import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./localAuth";

// OAuth configuration for social platforms
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  userInfoUrl?: string;
}

// Platform-specific OAuth configurations
// Note: Each platform requires its own OAuth credentials with the correct redirect URI configured
// YouTube: Requires YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET (NOT the same as GOOGLE_CLIENT_ID)
// TikTok: Requires TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET
// Instagram: Requires INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET (via Facebook/Meta)
function getOAuthConfig(platform: string, baseUrl: string): OAuthConfig | null {
  const configs: Record<string, OAuthConfig> = {
    youtube: {
      // Only use YouTube-specific credentials, NOT Google OAuth credentials
      // Google OAuth has different redirect URI and won't work here
      clientId: process.env.YOUTUBE_CLIENT_ID || "",
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || "",
      redirectUri: `${baseUrl}/api/oauth/youtube/callback`,
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      userInfoUrl: "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    },
    tiktok: {
      clientId: process.env.TIKTOK_CLIENT_KEY || "",
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
      redirectUri: `${baseUrl}/api/oauth/tiktok/callback`,
      authUrl: "https://www.tiktok.com/v2/auth/authorize/",
      tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
      scopes: ["user.info.basic", "user.info.stats"],
      userInfoUrl: "https://open.tiktokapis.com/v2/user/info/",
    },
    instagram: {
      clientId: process.env.INSTAGRAM_CLIENT_ID || "",
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || "",
      redirectUri: `${baseUrl}/api/oauth/instagram/callback`,
      authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
      scopes: ["instagram_basic", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"],
      userInfoUrl: "https://graph.facebook.com/v18.0/me/accounts",
    },
  };

  return configs[platform] || null;
}

// Check if OAuth is properly configured for a platform
function isOAuthConfigured(platform: string, baseUrl: string): boolean {
  const config = getOAuthConfig(platform, baseUrl);
  return !!(config?.clientId && config?.clientSecret);
}

// Generate simulated platform data (used when OAuth credentials not configured)
function generateSimulatedPlatformData(platform: string, username: string) {
  const hash = username.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const multiplier = (hash % 100) / 10 + 1;

  const baseFollowers = {
    youtube: Math.floor(10000 * multiplier),
    tiktok: Math.floor(50000 * multiplier),
    instagram: Math.floor(25000 * multiplier),
  };

  const baseVideos = {
    youtube: Math.floor(50 * multiplier),
    tiktok: Math.floor(200 * multiplier),
    instagram: Math.floor(150 * multiplier),
  };

  const baseViews = {
    youtube: Math.floor(500000 * multiplier),
    tiktok: Math.floor(2000000 * multiplier),
    instagram: Math.floor(1000000 * multiplier),
  };

  return {
    followers: baseFollowers[platform as keyof typeof baseFollowers] || 10000,
    videoCount: baseVideos[platform as keyof typeof baseVideos] || 50,
    totalViews: baseViews[platform as keyof typeof baseViews] || 100000,
    engagementRate: Math.round((2 + (hash % 8)) * 10) / 10,
    metadata: {
      platform,
      username,
      lastUpdated: new Date().toISOString(),
      verified: hash % 3 === 0,
      accountType: hash % 2 === 0 ? "creator" : "business",
    },
  };
}

// Fetch YouTube channel data using access token
async function fetchYouTubeData(accessToken: string): Promise<{
  username: string;
  profileUrl: string;
  followers: number;
  videoCount: number;
  totalViews: number;
  profileImageUrl?: string;
}> {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch YouTube channel data");
  }

  const data = await response.json();
  const channel = data.items?.[0];

  if (!channel) {
    throw new Error("No YouTube channel found for this account");
  }

  return {
    username: channel.snippet?.customUrl || channel.snippet?.title || "unknown",
    profileUrl: `https://youtube.com/${channel.snippet?.customUrl || `channel/${channel.id}`}`,
    followers: parseInt(channel.statistics?.subscriberCount || "0", 10),
    videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
    totalViews: parseInt(channel.statistics?.viewCount || "0", 10),
    profileImageUrl: channel.snippet?.thumbnails?.default?.url,
  };
}

// Fetch TikTok user data using access token
async function fetchTikTokData(accessToken: string): Promise<{
  username: string;
  profileUrl: string;
  followers: number;
  videoCount: number;
  totalViews: number;
  profileImageUrl?: string;
}> {
  const response = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch TikTok user data");
  }

  const data = await response.json();
  const user = data.data?.user;

  if (!user) {
    throw new Error("No TikTok user data found");
  }

  return {
    username: user.display_name || "unknown",
    profileUrl: `https://tiktok.com/@${user.display_name}`,
    followers: user.follower_count || 0,
    videoCount: user.video_count || 0,
    totalViews: user.likes_count || 0,
    profileImageUrl: user.avatar_url,
  };
}

// Fetch Instagram account data using access token
async function fetchInstagramData(accessToken: string): Promise<{
  username: string;
  profileUrl: string;
  followers: number;
  videoCount: number;
  totalViews: number;
  profileImageUrl?: string;
}> {
  // First, get the user's pages
  const pagesResponse = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
  );

  if (!pagesResponse.ok) {
    throw new Error("Failed to fetch Facebook pages");
  }

  const pagesData = await pagesResponse.json();
  const page = pagesData.data?.[0];

  if (!page) {
    throw new Error("No Facebook page found. Instagram Business accounts require a linked Facebook page.");
  }

  // Get the Instagram Business Account linked to this page
  const igResponse = await fetch(
    `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
  );

  if (!igResponse.ok) {
    throw new Error("Failed to fetch Instagram business account");
  }

  const igData = await igResponse.json();
  const igAccountId = igData.instagram_business_account?.id;

  if (!igAccountId) {
    throw new Error("No Instagram Business account linked to this Facebook page");
  }

  // Fetch Instagram account details
  const detailsResponse = await fetch(
    `https://graph.facebook.com/v18.0/${igAccountId}?fields=username,followers_count,media_count,profile_picture_url&access_token=${accessToken}`
  );

  if (!detailsResponse.ok) {
    throw new Error("Failed to fetch Instagram account details");
  }

  const details = await detailsResponse.json();

  return {
    username: details.username || "unknown",
    profileUrl: `https://instagram.com/${details.username}`,
    followers: details.followers_count || 0,
    videoCount: details.media_count || 0,
    totalViews: 0, // Instagram API doesn't provide total views
    profileImageUrl: details.profile_picture_url,
  };
}

// Exchange authorization code for access token
async function exchangeCodeForToken(
  platform: string,
  code: string,
  config: OAuthConfig
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const params = new URLSearchParams();
  params.append("client_id", config.clientId);
  params.append("client_secret", config.clientSecret);
  params.append("code", code);
  params.append("redirect_uri", config.redirectUri);
  params.append("grant_type", "authorization_code");

  // Debug logging
  console.log(`[Social OAuth] Token exchange for ${platform}:`);
  console.log(`[Social OAuth]   - Token URL: ${config.tokenUrl}`);
  console.log(`[Social OAuth]   - Client ID: ${config.clientId.substring(0, 20)}...`);
  console.log(`[Social OAuth]   - Redirect URI: ${config.redirectUri}`);
  console.log(`[Social OAuth]   - Code length: ${code.length}`);

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Social OAuth] Token exchange failed for ${platform}:`, error);
    console.error(`[Social OAuth] Make sure redirect URI in Google Cloud Console matches: ${config.redirectUri}`);
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// Setup social OAuth routes
export function setupSocialOAuth(app: Express) {
  const port = process.env.PORT || 3000;
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

  // Debug: Log OAuth configuration status on startup
  console.log("[Social OAuth] Setting up social media OAuth routes");
  console.log("[Social OAuth] Base URL:", baseUrl);
  console.log("[Social OAuth] YouTube OAuth configured:", !!process.env.YOUTUBE_CLIENT_ID && !!process.env.YOUTUBE_CLIENT_SECRET);
  console.log("[Social OAuth] TikTok OAuth configured:", !!process.env.TIKTOK_CLIENT_KEY && !!process.env.TIKTOK_CLIENT_SECRET);
  console.log("[Social OAuth] Instagram OAuth configured:", !!process.env.INSTAGRAM_CLIENT_ID && !!process.env.INSTAGRAM_CLIENT_SECRET);

  if (process.env.YOUTUBE_CLIENT_ID) {
    console.log("[Social OAuth] YouTube Client ID starts with:", process.env.YOUTUBE_CLIENT_ID.substring(0, 20) + "...");
    console.log("[Social OAuth] YouTube redirect URI:", `${baseUrl}/api/oauth/youtube/callback`);
  }

  // OAuth initiation endpoint - starts the OAuth flow
  app.get("/api/oauth/:platform/authorize", isAuthenticated, (req: Request, res: Response) => {
    const platform = req.params.platform as "youtube" | "tiktok" | "instagram";

    if (!["youtube", "tiktok", "instagram"].includes(platform)) {
      return res.status(400).json({ error: "Invalid platform" });
    }

    // Check if OAuth credentials are properly configured for this platform
    if (!isOAuthConfigured(platform, baseUrl)) {
      console.log(`[Social OAuth] No OAuth credentials for ${platform}, using simulated flow`);
      // Store user ID in session for callback
      (req.session as any).oauthUserId = (req.user as any).id;
      (req.session as any).oauthPlatform = platform;
      // Redirect to simulated callback with a simulated code
      const simulatedCode = `simulated_${platform}_${Date.now()}`;
      return res.redirect(`/api/oauth/${platform}/callback?code=${simulatedCode}&simulated=true`);
    }

    const config = getOAuthConfig(platform, baseUrl);

    if (!config) {
      return res.status(500).json({ error: "OAuth not configured for this platform" });
    }

    // Store user ID in session for callback
    (req.session as any).oauthUserId = (req.user as any).id;
    (req.session as any).oauthPlatform = platform;

    // Build authorization URL
    const authParams = new URLSearchParams();
    authParams.append("client_id", config.clientId);
    authParams.append("redirect_uri", config.redirectUri);
    authParams.append("response_type", "code");
    authParams.append("scope", config.scopes.join(" "));

    // Platform-specific parameters
    if (platform === "youtube") {
      authParams.append("access_type", "offline");
      authParams.append("prompt", "consent");
    } else if (platform === "tiktok") {
      authParams.append("response_type", "code");
    }

    // Add state parameter for CSRF protection
    const state = Buffer.from(
      JSON.stringify({ userId: (req.user as any).id, platform, timestamp: Date.now() })
    ).toString("base64");
    authParams.append("state", state);
    (req.session as any).oauthState = state;

    const authUrl = `${config.authUrl}?${authParams.toString()}`;
    console.log(`[Social OAuth] Redirecting to ${platform} OAuth:`, authUrl);

    res.redirect(authUrl);
  });

  // OAuth callback endpoint - handles the OAuth response
  app.get("/api/oauth/:platform/callback", async (req: Request, res: Response) => {
    const platform = req.params.platform as "youtube" | "tiktok" | "instagram";
    const { code, error, state, simulated } = req.query;

    console.log(`[Social OAuth] Callback received for ${platform}`, { code: !!code, error, simulated });

    if (error) {
      console.error(`[Social OAuth] OAuth error for ${platform}:`, error);
      return res.redirect(`/oauth-callback?error=${encodeURIComponent(error as string)}&platform=${platform}`);
    }

    if (!code) {
      return res.redirect(`/oauth-callback?error=no_code&platform=${platform}`);
    }

    try {
      // Get user ID from session or state
      let userId = (req.session as any).oauthUserId;

      if (!userId && state) {
        try {
          const stateData = JSON.parse(Buffer.from(state as string, "base64").toString());
          userId = stateData.userId;
        } catch {
          // State parsing failed
        }
      }

      if (!userId) {
        // Try to get from current user
        userId = (req.user as any)?.id;
      }

      if (!userId) {
        return res.redirect(`/oauth-callback?error=not_authenticated&platform=${platform}`);
      }

      const config = getOAuthConfig(platform, baseUrl);
      let platformData: {
        username: string;
        profileUrl: string;
        followers: number;
        videoCount: number;
        totalViews: number;
        profileImageUrl?: string;
        accessToken?: string;
        refreshToken?: string;
      };

      // Check if this is a simulated flow (no real OAuth credentials)
      if (simulated === "true" || !config?.clientId || !config?.clientSecret) {
        console.log(`[Social OAuth] Using simulated data for ${platform}`);
        // Generate simulated data
        const username = `demo_${platform}_user`;
        const simulatedData = generateSimulatedPlatformData(platform, username);
        platformData = {
          username,
          profileUrl:
            platform === "youtube"
              ? `https://youtube.com/@${username}`
              : platform === "tiktok"
              ? `https://tiktok.com/@${username}`
              : `https://instagram.com/${username}`,
          followers: simulatedData.followers,
          videoCount: simulatedData.videoCount,
          totalViews: simulatedData.totalViews,
        };
      } else {
        // Real OAuth flow
        const tokens = await exchangeCodeForToken(platform, code as string, config);

        // Fetch platform-specific data
        if (platform === "youtube") {
          platformData = {
            ...(await fetchYouTubeData(tokens.accessToken)),
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          };
        } else if (platform === "tiktok") {
          platformData = {
            ...(await fetchTikTokData(tokens.accessToken)),
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          };
        } else {
          platformData = {
            ...(await fetchInstagramData(tokens.accessToken)),
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          };
        }
      }

      // Store connection in database
      const connection = await storage.upsertSocialConnection({
        userId,
        platform,
        platformUsername: platformData.username,
        profileUrl: platformData.profileUrl,
        profileImageUrl: platformData.profileImageUrl,
        accessToken: platformData.accessToken,
        refreshToken: platformData.refreshToken,
        connectionStatus: "connected",
        followerCount: platformData.followers,
        subscriberCount: platform === "youtube" ? platformData.followers : null,
        videoCount: platformData.videoCount,
        totalViews: platformData.totalViews,
        avgEngagementRate: "5.0",
        lastSyncedAt: new Date(),
        metadata: {
          connectedVia: "oauth",
          lastUpdated: new Date().toISOString(),
        },
      });

      // Update creator profile with the URL and follower count
      const updates: Record<string, unknown> = {};
      if (platform === "youtube") {
        updates.youtubeUrl = platformData.profileUrl;
        updates.youtubeFollowers = platformData.followers;
      } else if (platform === "tiktok") {
        updates.tiktokUrl = platformData.profileUrl;
        updates.tiktokFollowers = platformData.followers;
      } else if (platform === "instagram") {
        updates.instagramUrl = platformData.profileUrl;
        updates.instagramFollowers = platformData.followers;
      }

      await storage.updateCreatorProfile(userId, updates);

      // Clear OAuth session data
      delete (req.session as any).oauthUserId;
      delete (req.session as any).oauthPlatform;
      delete (req.session as any).oauthState;

      console.log(`[Social OAuth] Successfully connected ${platform} for user ${userId}`);

      // Redirect to callback page with success
      const successParams = new URLSearchParams({
        success: "true",
        platform,
        username: platformData.username,
        followers: platformData.followers.toString(),
      });

      res.redirect(`/oauth-callback?${successParams.toString()}`);
    } catch (err: any) {
      console.error(`[Social OAuth] Error processing ${platform} callback:`, err);
      res.redirect(`/oauth-callback?error=${encodeURIComponent(err.message || "Connection failed")}&platform=${platform}`);
    }
  });

  // Endpoint to check if OAuth is configured for a platform
  app.get("/api/oauth/:platform/status", isAuthenticated, (req: Request, res: Response) => {
    const platform = req.params.platform;

    if (!["youtube", "tiktok", "instagram"].includes(platform)) {
      return res.status(400).json({ error: "Invalid platform" });
    }

    const isConfigured = isOAuthConfigured(platform, baseUrl);

    res.json({
      platform,
      oauthConfigured: isConfigured,
      // If not configured, simulated mode will be used
      mode: isConfigured ? "oauth" : "simulated",
    });
  });

  console.log("[Social OAuth] Social media OAuth routes configured");
}
