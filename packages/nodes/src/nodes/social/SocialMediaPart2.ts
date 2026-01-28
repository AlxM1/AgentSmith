import { createProgrammaticNode } from '@agentsmith/shared';

/**
 * TikTok API Node
 *
 * PRICING TIERS:
 * - Free: Read-only access, basic user info, video list
 * - Content Posting API: Requires approval from TikTok
 * - Commercial API: Enterprise pricing
 *
 * FREE TIER AVAILABLE: Yes (read-only)
 */
export const TikTok = createProgrammaticNode({
  name: 'TikTok',
  displayName: 'TikTok',
  description: 'Access TikTok videos, user info, and post content. FREE TIER: Read-only access',
  icon: 'file:tiktok.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'TikTok', color: '#000000' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'tiktokOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Read-only access | 💰 Content Posting: Requires approval | Enterprise: Custom pricing',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Get User Info', value: 'getUserInfo' },
        { name: 'Get User Videos', value: 'getUserVideos' },
        { name: 'Get Video Info', value: 'getVideoInfo' },
        { name: 'Upload Video (requires approval)', value: 'uploadVideo' },
        { name: 'Get Followers', value: 'getFollowers' },
        { name: 'Get Following', value: 'getFollowing' },
      ],
      default: 'getUserInfo',
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getUserInfo', 'getUserVideos'] } },
    },
    {
      displayName: 'Video ID',
      name: 'videoId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getVideoInfo'] } },
    },
    {
      displayName: 'Video URL',
      name: 'videoUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['uploadVideo'] } },
    },
    {
      displayName: 'Caption',
      name: 'caption',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      displayOptions: { show: { operation: ['uploadVideo'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Max Results', name: 'maxCount', type: 'number', default: 20 },
        { displayName: 'Privacy Level', name: 'privacyLevel', type: 'options', options: [
          { name: 'Public', value: 'PUBLIC_TO_EVERYONE' },
          { name: 'Friends', value: 'MUTUAL_FOLLOW_FRIENDS' },
          { name: 'Private', value: 'SELF_ONLY' },
        ], default: 'PUBLIC_TO_EVERYONE' },
        { displayName: 'Disable Comments', name: 'disableComment', type: 'boolean', default: false },
        { displayName: 'Disable Duet', name: 'disableDuet', type: 'boolean', default: false },
        { displayName: 'Disable Stitch', name: 'disableStitch', type: 'boolean', default: false },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('tiktokOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://open.tiktokapis.com/v2';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'getUserInfo': {
            result = await tiktokRequest('GET', `${baseUrl}/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count`, null, accessToken);
            break;
          }

          case 'getUserVideos': {
            const maxCount = options.maxCount || 20;
            result = await tiktokRequest('POST', `${baseUrl}/video/list/?fields=id,title,description,duration,cover_image_url,embed_link,like_count,comment_count,share_count,view_count,create_time`, {
              max_count: maxCount,
            }, accessToken);
            break;
          }

          case 'getVideoInfo': {
            const videoId = this.getNodeParameter('videoId', i) as string;
            result = await tiktokRequest('POST', `${baseUrl}/video/query/?fields=id,title,description,duration,cover_image_url,embed_link,like_count,comment_count,share_count,view_count,create_time`, {
              filters: { video_ids: [videoId] },
            }, accessToken);
            break;
          }

          case 'uploadVideo': {
            const videoUrl = this.getNodeParameter('videoUrl', i) as string;
            const caption = this.getNodeParameter('caption', i) as string;

            // Initialize upload
            const initResult = await tiktokRequest('POST', `${baseUrl}/post/publish/video/init/`, {
              post_info: {
                title: caption,
                privacy_level: options.privacyLevel || 'PUBLIC_TO_EVERYONE',
                disable_comment: options.disableComment || false,
                disable_duet: options.disableDuet || false,
                disable_stitch: options.disableStitch || false,
              },
              source_info: {
                source: 'PULL_FROM_URL',
                video_url: videoUrl,
              },
            }, accessToken);

            result = initResult;
            break;
          }

          case 'getFollowers': {
            const maxCount = options.maxCount || 20;
            result = await tiktokRequest('POST', `${baseUrl}/user/followers/?fields=open_id,display_name,avatar_url`, {
              max_count: maxCount,
            }, accessToken);
            break;
          }

          case 'getFollowing': {
            const maxCount = options.maxCount || 20;
            result = await tiktokRequest('POST', `${baseUrl}/user/following/?fields=open_id,display_name,avatar_url`, {
              max_count: maxCount,
            }, accessToken);
            break;
          }
        }

        returnData.push({ json: result.data || result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

/**
 * YouTube Data API Node
 *
 * PRICING TIERS:
 * - Free: 10,000 quota units/day (enough for ~100 searches or ~1000 video info)
 * - No paid tier - just quota limits
 *
 * FREE TIER AVAILABLE: Yes (generous quota)
 */
export const YouTube = createProgrammaticNode({
  name: 'YouTube',
  displayName: 'YouTube',
  description: 'Search videos, manage channels, get analytics. FREE TIER: 10,000 quota units/day',
  icon: 'file:youtube.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'YouTube', color: '#FF0000' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'youtubeOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 10,000 quota units/day | Search: 100 units | Video info: 1 unit | Upload: 1,600 units',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Search Videos', value: 'search' },
        { name: 'Get Video', value: 'getVideo' },
        { name: 'Get Channel', value: 'getChannel' },
        { name: 'Get My Channel', value: 'getMyChannel' },
        { name: 'Get Playlist Items', value: 'getPlaylistItems' },
        { name: 'Get Comments', value: 'getComments' },
        { name: 'Add Comment', value: 'addComment' },
        { name: 'Upload Video', value: 'uploadVideo' },
        { name: 'Update Video', value: 'updateVideo' },
        { name: 'Delete Video', value: 'deleteVideo' },
        { name: 'Get Subscriptions', value: 'getSubscriptions' },
        { name: 'Subscribe', value: 'subscribe' },
        { name: 'Unsubscribe', value: 'unsubscribe' },
        { name: 'Rate Video', value: 'rateVideo' },
      ],
      default: 'search',
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
    },
    {
      displayName: 'Video ID',
      name: 'videoId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getVideo', 'getComments', 'addComment', 'updateVideo', 'deleteVideo', 'rateVideo'] } },
    },
    {
      displayName: 'Channel ID',
      name: 'channelId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getChannel', 'subscribe', 'unsubscribe'] } },
    },
    {
      displayName: 'Playlist ID',
      name: 'playlistId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getPlaylistItems'] } },
    },
    {
      displayName: 'Comment Text',
      name: 'commentText',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      displayOptions: { show: { operation: ['addComment'] } },
    },
    {
      displayName: 'Video Title',
      name: 'videoTitle',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['uploadVideo', 'updateVideo'] } },
    },
    {
      displayName: 'Video Description',
      name: 'videoDescription',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { operation: ['uploadVideo', 'updateVideo'] } },
    },
    {
      displayName: 'Binary Property',
      name: 'binaryProperty',
      type: 'string',
      default: 'data',
      displayOptions: { show: { operation: ['uploadVideo'] } },
    },
    {
      displayName: 'Rating',
      name: 'rating',
      type: 'options',
      options: [
        { name: 'Like', value: 'like' },
        { name: 'Dislike', value: 'dislike' },
        { name: 'None (Remove)', value: 'none' },
      ],
      default: 'like',
      displayOptions: { show: { operation: ['rateVideo'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Max Results', name: 'maxResults', type: 'number', default: 25 },
        { displayName: 'Order', name: 'order', type: 'options', options: [
          { name: 'Date', value: 'date' },
          { name: 'Rating', value: 'rating' },
          { name: 'Relevance', value: 'relevance' },
          { name: 'Title', value: 'title' },
          { name: 'View Count', value: 'viewCount' },
        ], default: 'relevance' },
        { displayName: 'Video Type', name: 'type', type: 'options', options: [
          { name: 'Any', value: 'any' },
          { name: 'Episode', value: 'episode' },
          { name: 'Movie', value: 'movie' },
        ], default: 'any' },
        { displayName: 'Published After', name: 'publishedAfter', type: 'dateTime', default: '' },
        { displayName: 'Region Code', name: 'regionCode', type: 'string', default: '' },
        { displayName: 'Privacy Status', name: 'privacyStatus', type: 'options', options: [
          { name: 'Public', value: 'public' },
          { name: 'Unlisted', value: 'unlisted' },
          { name: 'Private', value: 'private' },
        ], default: 'public' },
        { displayName: 'Tags', name: 'tags', type: 'string', default: '', description: 'Comma-separated tags' },
        { displayName: 'Category ID', name: 'categoryId', type: 'string', default: '22' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('youtubeOAuth2Api');
    const accessToken = credentials.accessToken as string;
    const apiKey = credentials.apiKey as string;

    const baseUrl = 'https://www.googleapis.com/youtube/v3';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'search': {
            const query = this.getNodeParameter('query', i) as string;
            const params = new URLSearchParams({
              part: 'snippet',
              q: query,
              type: 'video',
              maxResults: String(options.maxResults || 25),
              order: options.order || 'relevance',
              key: apiKey,
            });
            if (options.publishedAfter) params.append('publishedAfter', new Date(options.publishedAfter).toISOString());
            if (options.regionCode) params.append('regionCode', options.regionCode);

            result = await youtubeRequest('GET', `${baseUrl}/search?${params}`, null, accessToken);
            break;
          }

          case 'getVideo': {
            const videoId = this.getNodeParameter('videoId', i) as string;
            result = await youtubeRequest('GET', `${baseUrl}/videos?part=snippet,contentDetails,statistics,status&id=${videoId}&key=${apiKey}`, null, accessToken);
            break;
          }

          case 'getChannel': {
            const channelId = this.getNodeParameter('channelId', i) as string;
            result = await youtubeRequest('GET', `${baseUrl}/channels?part=snippet,contentDetails,statistics,brandingSettings&id=${channelId}&key=${apiKey}`, null, accessToken);
            break;
          }

          case 'getMyChannel': {
            result = await youtubeRequest('GET', `${baseUrl}/channels?part=snippet,contentDetails,statistics,brandingSettings&mine=true`, null, accessToken);
            break;
          }

          case 'getPlaylistItems': {
            const playlistId = this.getNodeParameter('playlistId', i) as string;
            const maxResults = options.maxResults || 25;
            result = await youtubeRequest('GET', `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey}`, null, accessToken);
            break;
          }

          case 'getComments': {
            const videoId = this.getNodeParameter('videoId', i) as string;
            const maxResults = options.maxResults || 25;
            result = await youtubeRequest('GET', `${baseUrl}/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=${maxResults}&key=${apiKey}`, null, accessToken);
            break;
          }

          case 'addComment': {
            const videoId = this.getNodeParameter('videoId', i) as string;
            const commentText = this.getNodeParameter('commentText', i) as string;

            result = await youtubeRequest('POST', `${baseUrl}/commentThreads?part=snippet`, {
              snippet: {
                videoId,
                topLevelComment: {
                  snippet: { textOriginal: commentText },
                },
              },
            }, accessToken);
            break;
          }

          case 'uploadVideo': {
            const title = this.getNodeParameter('videoTitle', i) as string;
            const description = this.getNodeParameter('videoDescription', i) as string;
            const binaryProperty = this.getNodeParameter('binaryProperty', i) as string;
            const binaryData = items[i].binary?.[binaryProperty];

            if (!binaryData) throw new Error('No binary data found');

            // Create video metadata
            const metadata = {
              snippet: {
                title,
                description,
                tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
                categoryId: options.categoryId || '22',
              },
              status: {
                privacyStatus: options.privacyStatus || 'public',
              },
            };

            // Upload video (simplified - actual implementation would use resumable upload)
            result = await youtubeRequest('POST', `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status`, {
              metadata,
              media: Buffer.from(binaryData.data, 'base64'),
            }, accessToken);
            break;
          }

          case 'updateVideo': {
            const videoId = this.getNodeParameter('videoId', i) as string;
            const title = this.getNodeParameter('videoTitle', i) as string;
            const description = this.getNodeParameter('videoDescription', i) as string;

            result = await youtubeRequest('PUT', `${baseUrl}/videos?part=snippet,status`, {
              id: videoId,
              snippet: {
                title,
                description,
                tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined,
                categoryId: options.categoryId,
              },
            }, accessToken);
            break;
          }

          case 'deleteVideo': {
            const videoId = this.getNodeParameter('videoId', i) as string;
            await youtubeRequest('DELETE', `${baseUrl}/videos?id=${videoId}`, null, accessToken);
            result = { success: true, videoId };
            break;
          }

          case 'getSubscriptions': {
            const maxResults = options.maxResults || 25;
            result = await youtubeRequest('GET', `${baseUrl}/subscriptions?part=snippet,contentDetails&mine=true&maxResults=${maxResults}`, null, accessToken);
            break;
          }

          case 'subscribe': {
            const channelId = this.getNodeParameter('channelId', i) as string;
            result = await youtubeRequest('POST', `${baseUrl}/subscriptions?part=snippet`, {
              snippet: {
                resourceId: {
                  kind: 'youtube#channel',
                  channelId,
                },
              },
            }, accessToken);
            break;
          }

          case 'unsubscribe': {
            const channelId = this.getNodeParameter('channelId', i) as string;
            // First get subscription ID
            const subs = await youtubeRequest('GET', `${baseUrl}/subscriptions?part=id&mine=true&forChannelId=${channelId}`, null, accessToken);
            if (subs.items && subs.items.length > 0) {
              await youtubeRequest('DELETE', `${baseUrl}/subscriptions?id=${subs.items[0].id}`, null, accessToken);
            }
            result = { success: true, channelId };
            break;
          }

          case 'rateVideo': {
            const videoId = this.getNodeParameter('videoId', i) as string;
            const rating = this.getNodeParameter('rating', i) as string;
            await youtubeRequest('POST', `${baseUrl}/videos/rate?id=${videoId}&rating=${rating}`, null, accessToken);
            result = { success: true, videoId, rating };
            break;
          }
        }

        returnData.push({ json: result.items ? result.items : result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

/**
 * Reddit API Node
 *
 * PRICING TIERS:
 * - Free: 60 requests/minute for OAuth apps, 10 requests/minute for non-OAuth
 * - No paid tier
 *
 * FREE TIER AVAILABLE: Yes (generous limits)
 */
export const Reddit = createProgrammaticNode({
  name: 'Reddit',
  displayName: 'Reddit',
  description: 'Browse subreddits, post content, manage comments. FREE: 60 req/min (OAuth)',
  icon: 'file:reddit.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'Reddit', color: '#FF4500' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'redditOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: 60 requests/minute (OAuth) | No paid tiers',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Get Subreddit Posts', value: 'getSubredditPosts' },
        { name: 'Get Post', value: 'getPost' },
        { name: 'Search', value: 'search' },
        { name: 'Submit Post', value: 'submitPost' },
        { name: 'Submit Link', value: 'submitLink' },
        { name: 'Get Comments', value: 'getComments' },
        { name: 'Add Comment', value: 'addComment' },
        { name: 'Vote', value: 'vote' },
        { name: 'Get User', value: 'getUser' },
        { name: 'Get My Profile', value: 'getMyProfile' },
        { name: 'Get Saved', value: 'getSaved' },
        { name: 'Save', value: 'save' },
        { name: 'Unsave', value: 'unsave' },
      ],
      default: 'getSubredditPosts',
    },
    {
      displayName: 'Subreddit',
      name: 'subreddit',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getSubredditPosts', 'submitPost', 'submitLink', 'search'] } },
      description: 'Subreddit name without r/',
    },
    {
      displayName: 'Post ID',
      name: 'postId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getPost', 'getComments', 'addComment', 'vote', 'save', 'unsave'] } },
    },
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getUser'] } },
    },
    {
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['submitPost', 'submitLink'] } },
    },
    {
      displayName: 'Text',
      name: 'text',
      type: 'string',
      typeOptions: { rows: 5 },
      default: '',
      displayOptions: { show: { operation: ['submitPost', 'addComment'] } },
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['submitLink'] } },
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['search'] } },
    },
    {
      displayName: 'Vote Direction',
      name: 'voteDirection',
      type: 'options',
      options: [
        { name: 'Upvote', value: '1' },
        { name: 'Downvote', value: '-1' },
        { name: 'Remove Vote', value: '0' },
      ],
      default: '1',
      displayOptions: { show: { operation: ['vote'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Sort', name: 'sort', type: 'options', options: [
          { name: 'Hot', value: 'hot' },
          { name: 'New', value: 'new' },
          { name: 'Top', value: 'top' },
          { name: 'Rising', value: 'rising' },
          { name: 'Controversial', value: 'controversial' },
        ], default: 'hot' },
        { displayName: 'Time', name: 'time', type: 'options', options: [
          { name: 'Hour', value: 'hour' },
          { name: 'Day', value: 'day' },
          { name: 'Week', value: 'week' },
          { name: 'Month', value: 'month' },
          { name: 'Year', value: 'year' },
          { name: 'All', value: 'all' },
        ], default: 'day' },
        { displayName: 'Limit', name: 'limit', type: 'number', default: 25 },
        { displayName: 'NSFW', name: 'nsfw', type: 'boolean', default: false },
        { displayName: 'Spoiler', name: 'spoiler', type: 'boolean', default: false },
        { displayName: 'Flair ID', name: 'flairId', type: 'string', default: '' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('redditOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://oauth.reddit.com';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'getSubredditPosts': {
            const subreddit = this.getNodeParameter('subreddit', i) as string;
            const sort = options.sort || 'hot';
            const limit = options.limit || 25;
            let url = `${baseUrl}/r/${subreddit}/${sort}?limit=${limit}`;
            if (sort === 'top' || sort === 'controversial') {
              url += `&t=${options.time || 'day'}`;
            }
            result = await redditRequest('GET', url, null, accessToken);
            result = result.data.children.map((c: any) => c.data);
            break;
          }

          case 'getPost': {
            const postId = this.getNodeParameter('postId', i) as string;
            result = await redditRequest('GET', `${baseUrl}/api/info?id=t3_${postId}`, null, accessToken);
            result = result.data.children[0]?.data;
            break;
          }

          case 'search': {
            const query = this.getNodeParameter('query', i) as string;
            const subreddit = this.getNodeParameter('subreddit', i) as string;
            const sort = options.sort || 'relevance';
            const limit = options.limit || 25;
            let url = subreddit
              ? `${baseUrl}/r/${subreddit}/search?q=${encodeURIComponent(query)}&restrict_sr=1&sort=${sort}&limit=${limit}`
              : `${baseUrl}/search?q=${encodeURIComponent(query)}&sort=${sort}&limit=${limit}`;
            result = await redditRequest('GET', url, null, accessToken);
            result = result.data.children.map((c: any) => c.data);
            break;
          }

          case 'submitPost': {
            const subreddit = this.getNodeParameter('subreddit', i) as string;
            const title = this.getNodeParameter('title', i) as string;
            const text = this.getNodeParameter('text', i) as string;

            const body = new URLSearchParams({
              sr: subreddit,
              kind: 'self',
              title,
              text,
              nsfw: String(options.nsfw || false),
              spoiler: String(options.spoiler || false),
            });
            if (options.flairId) body.append('flair_id', options.flairId);

            result = await redditRequest('POST', `${baseUrl}/api/submit`, body, accessToken, true);
            break;
          }

          case 'submitLink': {
            const subreddit = this.getNodeParameter('subreddit', i) as string;
            const title = this.getNodeParameter('title', i) as string;
            const url = this.getNodeParameter('url', i) as string;

            const body = new URLSearchParams({
              sr: subreddit,
              kind: 'link',
              title,
              url,
              nsfw: String(options.nsfw || false),
              spoiler: String(options.spoiler || false),
            });

            result = await redditRequest('POST', `${baseUrl}/api/submit`, body, accessToken, true);
            break;
          }

          case 'getComments': {
            const postId = this.getNodeParameter('postId', i) as string;
            const limit = options.limit || 25;
            result = await redditRequest('GET', `${baseUrl}/comments/${postId}?limit=${limit}`, null, accessToken);
            result = result[1].data.children.map((c: any) => c.data);
            break;
          }

          case 'addComment': {
            const postId = this.getNodeParameter('postId', i) as string;
            const text = this.getNodeParameter('text', i) as string;

            const body = new URLSearchParams({
              thing_id: `t3_${postId}`,
              text,
            });

            result = await redditRequest('POST', `${baseUrl}/api/comment`, body, accessToken, true);
            break;
          }

          case 'vote': {
            const postId = this.getNodeParameter('postId', i) as string;
            const direction = this.getNodeParameter('voteDirection', i) as string;

            const body = new URLSearchParams({
              id: `t3_${postId}`,
              dir: direction,
            });

            await redditRequest('POST', `${baseUrl}/api/vote`, body, accessToken, true);
            result = { success: true, postId, direction };
            break;
          }

          case 'getUser': {
            const username = this.getNodeParameter('username', i) as string;
            result = await redditRequest('GET', `${baseUrl}/user/${username}/about`, null, accessToken);
            result = result.data;
            break;
          }

          case 'getMyProfile': {
            result = await redditRequest('GET', `${baseUrl}/api/v1/me`, null, accessToken);
            break;
          }

          case 'getSaved': {
            const limit = options.limit || 25;
            result = await redditRequest('GET', `${baseUrl}/user/me/saved?limit=${limit}`, null, accessToken);
            result = result.data.children.map((c: any) => c.data);
            break;
          }

          case 'save':
          case 'unsave': {
            const postId = this.getNodeParameter('postId', i) as string;
            const body = new URLSearchParams({ id: `t3_${postId}` });
            await redditRequest('POST', `${baseUrl}/api/${operation}`, body, accessToken, true);
            result = { success: true, postId };
            break;
          }
        }

        returnData.push({ json: result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

/**
 * Pinterest API Node
 *
 * PRICING TIERS:
 * - Free: Standard access for approved apps
 * - Business: Requires Pinterest Business account
 *
 * FREE TIER AVAILABLE: Yes (requires app approval)
 */
export const Pinterest = createProgrammaticNode({
  name: 'Pinterest',
  displayName: 'Pinterest',
  description: 'Create pins, manage boards, get analytics. FREE TIER: Full access with app approval',
  icon: 'file:pinterest.svg',
  group: ['social'],
  version: 1,
  defaults: { name: 'Pinterest', color: '#E60023' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [{ name: 'pinterestOAuth2Api', required: true }],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 FREE: Full API access | Requires app approval from Pinterest',
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Create Pin', value: 'createPin' },
        { name: 'Get Pin', value: 'getPin' },
        { name: 'Delete Pin', value: 'deletePin' },
        { name: 'Get Boards', value: 'getBoards' },
        { name: 'Create Board', value: 'createBoard' },
        { name: 'Get Board Pins', value: 'getBoardPins' },
        { name: 'Get User Profile', value: 'getUserProfile' },
        { name: 'Search Pins', value: 'searchPins' },
      ],
      default: 'createPin',
    },
    {
      displayName: 'Board ID',
      name: 'boardId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createPin', 'getBoardPins'] } },
    },
    {
      displayName: 'Pin ID',
      name: 'pinId',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['getPin', 'deletePin'] } },
    },
    {
      displayName: 'Title',
      name: 'title',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createPin', 'createBoard'] } },
    },
    {
      displayName: 'Description',
      name: 'description',
      type: 'string',
      typeOptions: { rows: 3 },
      default: '',
      displayOptions: { show: { operation: ['createPin', 'createBoard'] } },
    },
    {
      displayName: 'Image URL',
      name: 'imageUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createPin'] } },
    },
    {
      displayName: 'Link',
      name: 'link',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['createPin'] } },
    },
    {
      displayName: 'Query',
      name: 'query',
      type: 'string',
      default: '',
      displayOptions: { show: { operation: ['searchPins'] } },
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        { displayName: 'Alt Text', name: 'altText', type: 'string', default: '' },
        { displayName: 'Page Size', name: 'pageSize', type: 'number', default: 25 },
        { displayName: 'Privacy', name: 'privacy', type: 'options', options: [
          { name: 'Public', value: 'PUBLIC' },
          { name: 'Secret', value: 'SECRET' },
        ], default: 'PUBLIC' },
      ],
    },
  ],
  execute: async function () {
    const items = this.getInputData();
    const returnData: any[] = [];
    const credentials = await this.getCredentials('pinterestOAuth2Api');
    const accessToken = credentials.accessToken as string;

    const baseUrl = 'https://api.pinterest.com/v5';

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const options = this.getNodeParameter('options', i) as any;
        let result: any;

        switch (operation) {
          case 'createPin': {
            const boardId = this.getNodeParameter('boardId', i) as string;
            const title = this.getNodeParameter('title', i) as string;
            const description = this.getNodeParameter('description', i) as string;
            const imageUrl = this.getNodeParameter('imageUrl', i) as string;
            const link = this.getNodeParameter('link', i) as string;

            result = await pinterestRequest('POST', `${baseUrl}/pins`, {
              board_id: boardId,
              title,
              description,
              media_source: {
                source_type: 'image_url',
                url: imageUrl,
              },
              link,
              alt_text: options.altText || undefined,
            }, accessToken);
            break;
          }

          case 'getPin': {
            const pinId = this.getNodeParameter('pinId', i) as string;
            result = await pinterestRequest('GET', `${baseUrl}/pins/${pinId}`, null, accessToken);
            break;
          }

          case 'deletePin': {
            const pinId = this.getNodeParameter('pinId', i) as string;
            await pinterestRequest('DELETE', `${baseUrl}/pins/${pinId}`, null, accessToken);
            result = { success: true, pinId };
            break;
          }

          case 'getBoards': {
            const pageSize = options.pageSize || 25;
            result = await pinterestRequest('GET', `${baseUrl}/boards?page_size=${pageSize}`, null, accessToken);
            break;
          }

          case 'createBoard': {
            const title = this.getNodeParameter('title', i) as string;
            const description = this.getNodeParameter('description', i) as string;

            result = await pinterestRequest('POST', `${baseUrl}/boards`, {
              name: title,
              description,
              privacy: options.privacy || 'PUBLIC',
            }, accessToken);
            break;
          }

          case 'getBoardPins': {
            const boardId = this.getNodeParameter('boardId', i) as string;
            const pageSize = options.pageSize || 25;
            result = await pinterestRequest('GET', `${baseUrl}/boards/${boardId}/pins?page_size=${pageSize}`, null, accessToken);
            break;
          }

          case 'getUserProfile': {
            result = await pinterestRequest('GET', `${baseUrl}/user_account`, null, accessToken);
            break;
          }

          case 'searchPins': {
            const query = this.getNodeParameter('query', i) as string;
            const pageSize = options.pageSize || 25;
            result = await pinterestRequest('GET', `${baseUrl}/search/pins?query=${encodeURIComponent(query)}&page_size=${pageSize}`, null, accessToken);
            break;
          }
        }

        returnData.push({ json: result.items || result });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  },
});

// Helper functions
async function tiktokRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TikTok API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function youtubeRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`YouTube API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

async function redditRequest(method: string, url: string, body: any, accessToken: string, isForm = false): Promise<any> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'User-Agent': 'AgentSmith/1.0',
  };

  if (isForm) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? (isForm ? body.toString() : JSON.stringify(body)) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reddit API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function pinterestRequest(method: string, url: string, body: any, accessToken: string): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinterest API error: ${response.status} - ${error}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}
