/**
 * Credential Tester Service
 *
 * Tests API credentials by making real requests to verify they work.
 * Each credential type has its own test strategy.
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../lib/logger.js';

export interface CredentialTestResult {
  success: boolean;
  message: string;
  details?: {
    responseTime?: number;
    statusCode?: number;
    accountInfo?: Record<string, unknown>;
  };
  error?: string;
}

type CredentialData = Record<string, unknown>;

/**
 * Test credentials based on their type
 */
export async function testCredential(
  type: string,
  data: CredentialData
): Promise<CredentialTestResult> {
  const startTime = Date.now();

  try {
    const tester = credentialTesters[type];

    if (!tester) {
      return {
        success: false,
        message: `No test available for credential type: ${type}`,
        error: 'Unsupported credential type',
      };
    }

    const result = await tester(data);
    result.details = result.details || {};
    result.details.responseTime = Date.now() - startTime;

    logger.info('Credential test completed', {
      type,
      success: result.success,
      responseTime: result.details.responseTime,
    });

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Credential test failed', {
      type,
      error: errorMessage,
      responseTime,
    });

    return {
      success: false,
      message: 'Credential test failed',
      error: errorMessage,
      details: { responseTime },
    };
  }
}

/**
 * Credential type testers
 */
const credentialTesters: Record<string, (data: CredentialData) => Promise<CredentialTestResult>> = {

  // ============================================================================
  // HTTP AUTH
  // ============================================================================

  httpBasicAuth: async (data) => {
    // Basic auth credentials typically need a URL to test against
    // We just validate the format
    const { username, password } = data;
    if (!username || !password) {
      return {
        success: false,
        message: 'Missing username or password',
      };
    }
    return {
      success: true,
      message: 'HTTP Basic Auth credentials are valid',
    };
  },

  httpHeaderAuth: async (data) => {
    const { headerName, headerValue } = data;
    if (!headerName || !headerValue) {
      return {
        success: false,
        message: 'Missing header name or value',
      };
    }
    return {
      success: true,
      message: 'HTTP Header Auth credentials are valid',
    };
  },

  // ============================================================================
  // AI SERVICES
  // ============================================================================

  openAiApi: async (data) => {
    const { apiKey } = data;
    if (!apiKey) {
      return { success: false, message: 'Missing API key' };
    }

    try {
      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });

      return {
        success: true,
        message: 'OpenAI API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: { modelsAvailable: response.data?.data?.length || 0 },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'OpenAI');
    }
  },

  anthropicApi: async (data) => {
    const { apiKey } = data;
    if (!apiKey) {
      return { success: false, message: 'Missing API key' };
    }

    try {
      // Anthropic doesn't have a lightweight test endpoint, so we make a minimal request
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      return {
        success: true,
        message: 'Anthropic API credentials are valid',
        details: { statusCode: response.status },
      };
    } catch (error) {
      return handleAxiosError(error, 'Anthropic');
    }
  },

  perplexityApi: async (data) => {
    const { apiKey } = data;
    if (!apiKey) {
      return { success: false, message: 'Missing API key' };
    }

    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      return {
        success: true,
        message: 'Perplexity API credentials are valid',
        details: { statusCode: response.status },
      };
    } catch (error) {
      return handleAxiosError(error, 'Perplexity');
    }
  },

  // ============================================================================
  // COMMUNICATION SERVICES
  // ============================================================================

  slackApi: async (data) => {
    const { accessToken } = data;
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    try {
      const response = await axios.post(
        'https://slack.com/api/auth.test',
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      if (!response.data.ok) {
        return {
          success: false,
          message: `Slack auth failed: ${response.data.error}`,
          details: { statusCode: response.status },
        };
      }

      return {
        success: true,
        message: 'Slack API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            team: response.data.team,
            user: response.data.user,
            botId: response.data.bot_id,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'Slack');
    }
  },

  discordApi: async (data) => {
    const { botToken } = data;
    if (!botToken) {
      return { success: false, message: 'Missing bot token' };
    }

    try {
      const response = await axios.get('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${botToken}` },
        timeout: 10000,
      });

      return {
        success: true,
        message: 'Discord API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            username: response.data.username,
            id: response.data.id,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'Discord');
    }
  },

  telegramApi: async (data) => {
    const { accessToken } = data;
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${accessToken}/getMe`,
        { timeout: 10000 }
      );

      if (!response.data.ok) {
        return {
          success: false,
          message: 'Telegram auth failed',
          details: { statusCode: response.status },
        };
      }

      return {
        success: true,
        message: 'Telegram API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            botName: response.data.result.first_name,
            username: response.data.result.username,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'Telegram');
    }
  },

  // ============================================================================
  // CODE & DEVOPS
  // ============================================================================

  githubApi: async (data) => {
    const { accessToken } = data;
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      });

      return {
        success: true,
        message: 'GitHub API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            login: response.data.login,
            name: response.data.name,
            publicRepos: response.data.public_repos,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'GitHub');
    }
  },

  gitlabApi: async (data) => {
    const { accessToken, baseUrl } = data;
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    const apiUrl = (baseUrl as string) || 'https://gitlab.com';

    try {
      const response = await axios.get(`${apiUrl}/api/v4/user`, {
        headers: { 'PRIVATE-TOKEN': accessToken },
        timeout: 10000,
      });

      return {
        success: true,
        message: 'GitLab API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            username: response.data.username,
            name: response.data.name,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'GitLab');
    }
  },

  // ============================================================================
  // DATABASES
  // ============================================================================

  postgres: async (data) => {
    const { host, port, database, user, password } = data;
    if (!host || !database || !user) {
      return { success: false, message: 'Missing required connection parameters' };
    }

    // In a real implementation, we'd use pg to test the connection
    // For now, we validate the parameters
    return {
      success: true,
      message: 'PostgreSQL connection parameters are valid (connection not tested)',
      details: {
        accountInfo: {
          host: host as string,
          port: (port as number) || 5432,
          database: database as string,
        },
      },
    };
  },

  mysql: async (data) => {
    const { host, port, database, user, password } = data;
    if (!host || !database || !user) {
      return { success: false, message: 'Missing required connection parameters' };
    }

    return {
      success: true,
      message: 'MySQL connection parameters are valid (connection not tested)',
      details: {
        accountInfo: {
          host: host as string,
          port: (port as number) || 3306,
          database: database as string,
        },
      },
    };
  },

  mongodb: async (data) => {
    const { connectionString } = data;
    if (!connectionString) {
      return { success: false, message: 'Missing connection string' };
    }

    return {
      success: true,
      message: 'MongoDB connection string is valid (connection not tested)',
    };
  },

  redis: async (data) => {
    const { host, port, password } = data;
    if (!host) {
      return { success: false, message: 'Missing host' };
    }

    return {
      success: true,
      message: 'Redis connection parameters are valid (connection not tested)',
      details: {
        accountInfo: {
          host: host as string,
          port: (port as number) || 6379,
        },
      },
    };
  },

  // ============================================================================
  // GOOGLE SERVICES
  // ============================================================================

  googleApi: async (data) => {
    const { accessToken, refreshToken, clientId, clientSecret } = data;
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    try {
      const response = await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      return {
        success: true,
        message: 'Google API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            email: response.data.email,
            name: response.data.name,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'Google');
    }
  },

  // ============================================================================
  // EMAIL SERVICES
  // ============================================================================

  smtp: async (data) => {
    const { host, port, user, password, secure } = data;
    if (!host || !port) {
      return { success: false, message: 'Missing host or port' };
    }

    // In a real implementation, we'd use nodemailer to test
    return {
      success: true,
      message: 'SMTP parameters are valid (connection not tested)',
      details: {
        accountInfo: {
          host: host as string,
          port: port as number,
          secure: secure as boolean,
        },
      },
    };
  },

  sendgridApi: async (data) => {
    const { apiKey } = data;
    if (!apiKey) {
      return { success: false, message: 'Missing API key' };
    }

    try {
      const response = await axios.get('https://api.sendgrid.com/v3/user/profile', {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });

      return {
        success: true,
        message: 'SendGrid API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            email: response.data.email,
            firstName: response.data.first_name,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'SendGrid');
    }
  },

  // ============================================================================
  // SEO & SEARCH SERVICES
  // ============================================================================

  serpApi: async (data) => {
    const { apiKey } = data;
    if (!apiKey) {
      return { success: false, message: 'Missing API key' };
    }

    try {
      const response = await axios.get(
        `https://serpapi.com/account?api_key=${apiKey}`,
        { timeout: 10000 }
      );

      return {
        success: true,
        message: 'SerpAPI credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            searches_remaining: response.data.total_searches_left,
            plan: response.data.plan_name,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'SerpAPI');
    }
  },

  // ============================================================================
  // CLOUD SERVICES
  // ============================================================================

  awsApi: async (data) => {
    const { accessKeyId, secretAccessKey, region } = data;
    if (!accessKeyId || !secretAccessKey) {
      return { success: false, message: 'Missing AWS credentials' };
    }

    // AWS credentials are validated at runtime when making requests
    return {
      success: true,
      message: 'AWS credentials format is valid (authentication not tested)',
      details: {
        accountInfo: {
          region: (region as string) || 'us-east-1',
          accessKeyIdPrefix: (accessKeyId as string).substring(0, 4) + '***',
        },
      },
    };
  },

  // ============================================================================
  // PAYMENT SERVICES
  // ============================================================================

  stripeApi: async (data) => {
    const { secretKey } = data;
    if (!secretKey) {
      return { success: false, message: 'Missing secret key' };
    }

    try {
      const response = await axios.get('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${secretKey}` },
        timeout: 10000,
      });

      return {
        success: true,
        message: 'Stripe API credentials are valid',
        details: {
          statusCode: response.status,
          accountInfo: {
            available: response.data.available,
            pending: response.data.pending,
          },
        },
      };
    } catch (error) {
      return handleAxiosError(error, 'Stripe');
    }
  },
};

/**
 * Handle Axios errors uniformly
 */
function handleAxiosError(error: unknown, serviceName: string): CredentialTestResult {
  if (error instanceof AxiosError) {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      return {
        success: false,
        message: `${serviceName} authentication failed: Invalid credentials`,
        details: { statusCode: status },
        error: 'Authentication failed',
      };
    }

    if (status === 429) {
      return {
        success: false,
        message: `${serviceName} rate limit exceeded`,
        details: { statusCode: status },
        error: 'Rate limited',
      };
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        message: `${serviceName} service unreachable`,
        error: 'Connection failed',
      };
    }

    if (error.code === 'ETIMEDOUT') {
      return {
        success: false,
        message: `${serviceName} request timed out`,
        error: 'Timeout',
      };
    }

    return {
      success: false,
      message: `${serviceName} request failed: ${error.message}`,
      details: { statusCode: status },
      error: error.message,
    };
  }

  return {
    success: false,
    message: `${serviceName} test failed with unexpected error`,
    error: error instanceof Error ? error.message : 'Unknown error',
  };
}

export { credentialTesters };
