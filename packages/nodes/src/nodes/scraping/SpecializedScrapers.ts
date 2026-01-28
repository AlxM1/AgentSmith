// Specialized Scraper Nodes
// Pre-built scrapers for common use cases

import { createProgrammaticNode } from '@agentsmith/shared';

// ============================================
// JOB BOARD AGGREGATOR
// ============================================

export const JobBoardScraper = createProgrammaticNode({
  name: 'JobBoardScraper',
  displayName: 'Job Board Scraper',
  description: 'Scrape job listings from multiple job boards',
  icon: 'briefcase',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Job Scraper' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'scraperApi', required: false },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 Self-hosted scraping is free | 💰 May need proxy service for large volumes | Respect robots.txt',
    },
    {
      displayName: 'Job Boards',
      name: 'jobBoards',
      type: 'multiOptions',
      options: [
        { name: 'LinkedIn Jobs', value: 'linkedin' },
        { name: 'Indeed', value: 'indeed' },
        { name: 'Glassdoor', value: 'glassdoor' },
        { name: 'ZipRecruiter', value: 'ziprecruiter' },
        { name: 'Monster', value: 'monster' },
        { name: 'AngelList/Wellfound', value: 'angellist' },
        { name: 'We Work Remotely', value: 'weworkremotely' },
        { name: 'Remote OK', value: 'remoteok' },
        { name: 'Stack Overflow Jobs', value: 'stackoverflow' },
        { name: 'GitHub Jobs', value: 'github' },
        { name: 'Dice', value: 'dice' },
        { name: 'SimplyHired', value: 'simplyhired' },
      ],
      default: ['linkedin', 'indeed'],
    },
    {
      displayName: 'Job Title / Keywords',
      name: 'keywords',
      type: 'string',
      default: '',
      placeholder: 'Software Engineer, Python Developer',
    },
    {
      displayName: 'Location',
      name: 'location',
      type: 'string',
      default: '',
      placeholder: 'San Francisco, CA or Remote',
    },
    {
      displayName: 'Filters',
      name: 'filters',
      type: 'collection',
      placeholder: 'Add Filter',
      default: {},
      options: [
        {
          displayName: 'Experience Level',
          name: 'experienceLevel',
          type: 'multiOptions',
          options: [
            { name: 'Entry Level', value: 'entry' },
            { name: 'Mid Level', value: 'mid' },
            { name: 'Senior', value: 'senior' },
            { name: 'Lead/Manager', value: 'lead' },
            { name: 'Executive', value: 'executive' },
          ],
          default: [],
        },
        {
          displayName: 'Job Type',
          name: 'jobType',
          type: 'multiOptions',
          options: [
            { name: 'Full-time', value: 'fulltime' },
            { name: 'Part-time', value: 'parttime' },
            { name: 'Contract', value: 'contract' },
            { name: 'Internship', value: 'internship' },
            { name: 'Temporary', value: 'temporary' },
          ],
          default: ['fulltime'],
        },
        {
          displayName: 'Remote',
          name: 'remote',
          type: 'options',
          options: [
            { name: 'Any', value: 'any' },
            { name: 'Remote Only', value: 'remote' },
            { name: 'Hybrid', value: 'hybrid' },
            { name: 'On-site Only', value: 'onsite' },
          ],
          default: 'any',
        },
        {
          displayName: 'Salary Min',
          name: 'salaryMin',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Salary Max',
          name: 'salaryMax',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Date Posted',
          name: 'datePosted',
          type: 'options',
          options: [
            { name: 'Any Time', value: 'any' },
            { name: 'Past 24 Hours', value: '24h' },
            { name: 'Past Week', value: '7d' },
            { name: 'Past Month', value: '30d' },
          ],
          default: 'any',
        },
      ],
    },
    {
      displayName: 'Max Results Per Board',
      name: 'maxResults',
      type: 'number',
      default: 25,
    },
    {
      displayName: 'Output Options',
      name: 'outputOptions',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Include Description',
          name: 'includeDescription',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Include Company Info',
          name: 'includeCompanyInfo',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Deduplicate',
          name: 'deduplicate',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Sort By',
          name: 'sortBy',
          type: 'options',
          options: [
            { name: 'Relevance', value: 'relevance' },
            { name: 'Date Posted', value: 'date' },
            { name: 'Salary', value: 'salary' },
          ],
          default: 'date',
        },
      ],
    },
  ],
  async execute(context) {
    const jobBoards = context.getNodeParameter('jobBoards', 0) as string[];
    const keywords = context.getNodeParameter('keywords', 0) as string;
    const location = context.getNodeParameter('location', 0);
    const filters = context.getNodeParameter('filters', 0) as Record<string, unknown>;
    const maxResults = context.getNodeParameter('maxResults', 0);
    const outputOptions = context.getNodeParameter('outputOptions', 0) as Record<string, unknown>;

    // Simulated job scraping results
    const jobs = [
      {
        id: 'job_1',
        title: 'Senior Software Engineer',
        company: 'Tech Company Inc.',
        location: 'San Francisco, CA',
        remote: 'Hybrid',
        salary: { min: 150000, max: 200000, currency: 'USD' },
        description: 'We are looking for a senior software engineer...',
        requirements: ['5+ years experience', 'Python', 'AWS', 'Kubernetes'],
        benefits: ['Health insurance', '401k', 'Unlimited PTO'],
        postedDate: '2024-01-20',
        applicationUrl: 'https://example.com/apply/123',
        source: 'linkedin',
        companyInfo: {
          size: '100-500 employees',
          industry: 'Technology',
          rating: 4.2,
        },
      },
      {
        id: 'job_2',
        title: 'Python Developer',
        company: 'StartupXYZ',
        location: 'Remote',
        remote: 'Remote',
        salary: { min: 120000, max: 160000, currency: 'USD' },
        description: 'Join our fast-growing team...',
        requirements: ['3+ years Python', 'Django/FastAPI', 'PostgreSQL'],
        benefits: ['Stock options', 'Flexible hours', 'Learning budget'],
        postedDate: '2024-01-21',
        applicationUrl: 'https://example.com/apply/456',
        source: 'indeed',
        companyInfo: {
          size: '10-50 employees',
          industry: 'SaaS',
          rating: 4.5,
        },
      },
    ];

    const result = {
      search: {
        keywords,
        location,
        filters,
        jobBoards,
      },
      summary: {
        totalFound: jobs.length,
        byBoard: {
          linkedin: 1,
          indeed: 1,
        },
        averageSalary: {
          min: 135000,
          max: 180000,
        },
        remotePercentage: 50,
      },
      jobs,
      metadata: {
        scrapedAt: new Date().toISOString(),
        boardsSearched: jobBoards.length,
        duplicatesRemoved: outputOptions.deduplicate ? 2 : 0,
      },
    };

    return [[{ json: result }]];
  },
});

// ============================================
// REVIEW AGGREGATOR
// ============================================

export const ReviewAggregator = createProgrammaticNode({
  name: 'ReviewAggregator',
  displayName: 'Review Aggregator',
  description: 'Aggregate reviews from multiple platforms',
  icon: 'star',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Review Aggregator' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'scraperApi', required: false },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 Some APIs are free | 💰 Google Places API: $17/1000 | Yelp: free tier available',
    },
    {
      displayName: 'Review Platforms',
      name: 'platforms',
      type: 'multiOptions',
      options: [
        { name: 'Google Reviews', value: 'google' },
        { name: 'Yelp', value: 'yelp' },
        { name: 'TripAdvisor', value: 'tripadvisor' },
        { name: 'Trustpilot', value: 'trustpilot' },
        { name: 'G2', value: 'g2' },
        { name: 'Capterra', value: 'capterra' },
        { name: 'Amazon Reviews', value: 'amazon' },
        { name: 'App Store', value: 'appstore' },
        { name: 'Google Play', value: 'playstore' },
        { name: 'Facebook', value: 'facebook' },
        { name: 'BBB', value: 'bbb' },
      ],
      default: ['google', 'yelp'],
    },
    {
      displayName: 'Search Type',
      name: 'searchType',
      type: 'options',
      options: [
        { name: 'Business Name', value: 'business' },
        { name: 'Product/App Name', value: 'product' },
        { name: 'Direct URL', value: 'url' },
        { name: 'Place ID', value: 'placeId' },
      ],
      default: 'business',
    },
    {
      displayName: 'Business/Product Name',
      name: 'name',
      type: 'string',
      default: '',
      displayOptions: { show: { searchType: ['business', 'product'] } },
    },
    {
      displayName: 'URL',
      name: 'url',
      type: 'string',
      default: '',
      displayOptions: { show: { searchType: ['url'] } },
    },
    {
      displayName: 'Location (for local businesses)',
      name: 'location',
      type: 'string',
      default: '',
      placeholder: 'City, State or Address',
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Max Reviews Per Platform',
          name: 'maxReviews',
          type: 'number',
          default: 100,
        },
        {
          displayName: 'Min Rating',
          name: 'minRating',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Sort By',
          name: 'sortBy',
          type: 'options',
          options: [
            { name: 'Most Recent', value: 'recent' },
            { name: 'Highest Rated', value: 'highest' },
            { name: 'Lowest Rated', value: 'lowest' },
            { name: 'Most Helpful', value: 'helpful' },
          ],
          default: 'recent',
        },
        {
          displayName: 'Date Range',
          name: 'dateRange',
          type: 'options',
          options: [
            { name: 'All Time', value: 'all' },
            { name: 'Past Month', value: '30d' },
            { name: 'Past 6 Months', value: '180d' },
            { name: 'Past Year', value: '365d' },
          ],
          default: 'all',
        },
        {
          displayName: 'Include Sentiment Analysis',
          name: 'analyzeSentiment',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Extract Keywords',
          name: 'extractKeywords',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],
  async execute(context) {
    const platforms = context.getNodeParameter('platforms', 0) as string[];
    const searchType = context.getNodeParameter('searchType', 0);
    const name = context.getNodeParameter('name', 0) as string;
    const location = context.getNodeParameter('location', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    // Simulated review aggregation
    const reviews = [
      {
        id: 'review_1',
        platform: 'google',
        author: 'John D.',
        rating: 5,
        title: 'Great experience!',
        text: 'Really enjoyed the service. Staff was friendly and professional.',
        date: '2024-01-15',
        helpful: 12,
        verified: true,
        response: {
          text: 'Thank you for your kind words!',
          date: '2024-01-16',
        },
      },
      {
        id: 'review_2',
        platform: 'yelp',
        author: 'Sarah M.',
        rating: 4,
        title: 'Good but could improve',
        text: 'Overall positive experience. Wait time was a bit long.',
        date: '2024-01-10',
        helpful: 5,
        verified: true,
        photos: ['photo1.jpg'],
      },
      {
        id: 'review_3',
        platform: 'google',
        author: 'Mike R.',
        rating: 2,
        title: 'Disappointed',
        text: 'Expected better quality for the price.',
        date: '2024-01-05',
        helpful: 3,
        verified: false,
      },
    ];

    const result = {
      search: {
        name,
        location,
        platforms,
        searchType,
      },
      summary: {
        totalReviews: reviews.length,
        averageRating: 3.67,
        ratingDistribution: {
          5: 1,
          4: 1,
          3: 0,
          2: 1,
          1: 0,
        },
        byPlatform: {
          google: { count: 2, avgRating: 3.5 },
          yelp: { count: 1, avgRating: 4.0 },
        },
        recentTrend: 'improving',
      },
      sentiment: options.analyzeSentiment ? {
        positive: 0.55,
        neutral: 0.25,
        negative: 0.20,
        topPositiveThemes: ['friendly staff', 'good service'],
        topNegativeThemes: ['wait time', 'price'],
      } : undefined,
      keywords: options.extractKeywords ? {
        mostMentioned: ['service', 'staff', 'quality', 'price', 'wait'],
        trending: ['friendly', 'professional'],
      } : undefined,
      reviews,
      metadata: {
        aggregatedAt: new Date().toISOString(),
        platformsSearched: platforms.length,
      },
    };

    return [[{ json: result }]];
  },
});

// ============================================
// PRICE TRACKER
// ============================================

export const PriceTracker = createProgrammaticNode({
  name: 'PriceTracker',
  displayName: 'Price Tracker',
  description: 'Track prices across e-commerce sites',
  icon: 'tag',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Price Tracker' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'scraperApi', required: false },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 Self-hosted scraping is free | 💰 Proxy services for anti-bot bypass | Rainforest API for Amazon',
    },
    {
      displayName: 'Platforms',
      name: 'platforms',
      type: 'multiOptions',
      options: [
        { name: 'Amazon', value: 'amazon' },
        { name: 'eBay', value: 'ebay' },
        { name: 'Walmart', value: 'walmart' },
        { name: 'Target', value: 'target' },
        { name: 'Best Buy', value: 'bestbuy' },
        { name: 'Newegg', value: 'newegg' },
        { name: 'AliExpress', value: 'aliexpress' },
        { name: 'Etsy', value: 'etsy' },
        { name: 'Google Shopping', value: 'google' },
        { name: 'Custom URL', value: 'custom' },
      ],
      default: ['amazon'],
    },
    {
      displayName: 'Search Method',
      name: 'searchMethod',
      type: 'options',
      options: [
        { name: 'Product URL', value: 'url' },
        { name: 'Product Name/Keywords', value: 'search' },
        { name: 'ASIN (Amazon)', value: 'asin' },
        { name: 'UPC/EAN', value: 'upc' },
      ],
      default: 'url',
    },
    {
      displayName: 'Product URL',
      name: 'productUrl',
      type: 'string',
      default: '',
      displayOptions: { show: { searchMethod: ['url'] } },
    },
    {
      displayName: 'Product Name',
      name: 'productName',
      type: 'string',
      default: '',
      displayOptions: { show: { searchMethod: ['search'] } },
    },
    {
      displayName: 'ASIN',
      name: 'asin',
      type: 'string',
      default: '',
      displayOptions: { show: { searchMethod: ['asin'] } },
    },
    {
      displayName: 'UPC/EAN',
      name: 'upc',
      type: 'string',
      default: '',
      displayOptions: { show: { searchMethod: ['upc'] } },
    },
    {
      displayName: 'Tracking Options',
      name: 'trackingOptions',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Include Shipping',
          name: 'includeShipping',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Include Tax',
          name: 'includeTax',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Check Availability',
          name: 'checkAvailability',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Get Price History',
          name: 'getPriceHistory',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Find Similar Products',
          name: 'findSimilar',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Alert When Below',
          name: 'alertPrice',
          type: 'number',
          default: 0,
        },
      ],
    },
  ],
  async execute(context) {
    const platforms = context.getNodeParameter('platforms', 0) as string[];
    const searchMethod = context.getNodeParameter('searchMethod', 0);
    const trackingOptions = context.getNodeParameter('trackingOptions', 0) as Record<string, unknown>;

    let productIdentifier = '';
    switch (searchMethod) {
      case 'url':
        productIdentifier = context.getNodeParameter('productUrl', 0) as string;
        break;
      case 'search':
        productIdentifier = context.getNodeParameter('productName', 0) as string;
        break;
      case 'asin':
        productIdentifier = context.getNodeParameter('asin', 0) as string;
        break;
      case 'upc':
        productIdentifier = context.getNodeParameter('upc', 0) as string;
        break;
    }

    // Simulated price tracking results
    const priceData = {
      product: {
        name: 'Example Product XYZ',
        brand: 'Brand Name',
        category: 'Electronics',
        image: 'https://example.com/product.jpg',
        upc: '012345678901',
      },
      currentPrices: [
        {
          platform: 'amazon',
          price: 99.99,
          currency: 'USD',
          shipping: trackingOptions.includeShipping ? 0 : undefined,
          inStock: true,
          seller: 'Amazon.com',
          url: 'https://amazon.com/product/...',
          lastUpdated: new Date().toISOString(),
          primeEligible: true,
        },
        {
          platform: 'walmart',
          price: 104.99,
          currency: 'USD',
          shipping: trackingOptions.includeShipping ? 5.99 : undefined,
          inStock: true,
          seller: 'Walmart.com',
          url: 'https://walmart.com/product/...',
          lastUpdated: new Date().toISOString(),
        },
        {
          platform: 'ebay',
          price: 89.99,
          currency: 'USD',
          shipping: trackingOptions.includeShipping ? 8.99 : undefined,
          inStock: true,
          seller: 'top_seller_123',
          url: 'https://ebay.com/itm/...',
          lastUpdated: new Date().toISOString(),
          condition: 'New',
        },
      ],
      bestPrice: {
        platform: 'ebay',
        totalPrice: 98.98,
        savings: 6.01,
        savingsPercent: 5.7,
      },
      priceHistory: trackingOptions.getPriceHistory ? {
        amazon: [
          { date: '2024-01-01', price: 109.99 },
          { date: '2024-01-10', price: 104.99 },
          { date: '2024-01-20', price: 99.99 },
        ],
        walmart: [
          { date: '2024-01-01', price: 109.99 },
          { date: '2024-01-15', price: 104.99 },
        ],
      } : undefined,
      priceAnalysis: {
        lowestEver: { price: 79.99, date: '2023-11-24', platform: 'amazon' },
        highestEver: { price: 129.99, date: '2023-06-15', platform: 'amazon' },
        averagePrice: 99.99,
        currentVsAverage: 0,
        recommendation: 'Fair price - close to average',
      },
      alert: trackingOptions.alertPrice ? {
        targetPrice: trackingOptions.alertPrice,
        triggered: (trackingOptions.alertPrice as number) >= 89.99,
        matchingOffers: 1,
      } : undefined,
      similarProducts: trackingOptions.findSimilar ? [
        { name: 'Similar Product A', price: 94.99, platform: 'amazon' },
        { name: 'Similar Product B', price: 89.99, platform: 'walmart' },
      ] : undefined,
      metadata: {
        trackedAt: new Date().toISOString(),
        platformsChecked: platforms.length,
      },
    };

    return [[{ json: priceData }]];
  },
});

// ============================================
// REAL ESTATE SCRAPER
// ============================================

export const RealEstateScraper = createProgrammaticNode({
  name: 'RealEstateScraper',
  displayName: 'Real Estate Scraper',
  description: 'Scrape property listings from real estate sites',
  icon: 'home',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Real Estate Scraper' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'scraperApi', required: false },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 Self-hosted is free | Most sites require proxy rotation | RapidAPI has Zillow/Realtor APIs',
    },
    {
      displayName: 'Platforms',
      name: 'platforms',
      type: 'multiOptions',
      options: [
        { name: 'Zillow', value: 'zillow' },
        { name: 'Realtor.com', value: 'realtor' },
        { name: 'Redfin', value: 'redfin' },
        { name: 'Trulia', value: 'trulia' },
        { name: 'Homes.com', value: 'homes' },
        { name: 'Apartments.com', value: 'apartments' },
        { name: 'Rent.com', value: 'rent' },
        { name: 'Craigslist', value: 'craigslist' },
        { name: 'MLS (if available)', value: 'mls' },
      ],
      default: ['zillow', 'realtor'],
    },
    {
      displayName: 'Listing Type',
      name: 'listingType',
      type: 'options',
      options: [
        { name: 'For Sale', value: 'sale' },
        { name: 'For Rent', value: 'rent' },
        { name: 'Recently Sold', value: 'sold' },
        { name: 'Foreclosures', value: 'foreclosure' },
      ],
      default: 'sale',
    },
    {
      displayName: 'Location',
      name: 'location',
      type: 'string',
      default: '',
      placeholder: 'City, State or Zip Code',
    },
    {
      displayName: 'Filters',
      name: 'filters',
      type: 'collection',
      placeholder: 'Add Filter',
      default: {},
      options: [
        {
          displayName: 'Min Price',
          name: 'minPrice',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Max Price',
          name: 'maxPrice',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Min Bedrooms',
          name: 'minBeds',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Max Bedrooms',
          name: 'maxBeds',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Min Bathrooms',
          name: 'minBaths',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Property Type',
          name: 'propertyType',
          type: 'multiOptions',
          options: [
            { name: 'House', value: 'house' },
            { name: 'Condo', value: 'condo' },
            { name: 'Townhouse', value: 'townhouse' },
            { name: 'Multi-family', value: 'multifamily' },
            { name: 'Land', value: 'land' },
            { name: 'Apartment', value: 'apartment' },
          ],
          default: [],
        },
        {
          displayName: 'Min Sqft',
          name: 'minSqft',
          type: 'number',
          default: 0,
        },
        {
          displayName: 'Year Built (Min)',
          name: 'yearBuiltMin',
          type: 'number',
          default: 0,
        },
      ],
    },
    {
      displayName: 'Max Results',
      name: 'maxResults',
      type: 'number',
      default: 50,
    },
    {
      displayName: 'Include Details',
      name: 'includeDetails',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Property History',
          name: 'propertyHistory',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Tax Information',
          name: 'taxInfo',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Schools Nearby',
          name: 'schools',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Neighborhood Stats',
          name: 'neighborhood',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Photos',
          name: 'photos',
          type: 'boolean',
          default: true,
        },
      ],
    },
  ],
  async execute(context) {
    const platforms = context.getNodeParameter('platforms', 0) as string[];
    const listingType = context.getNodeParameter('listingType', 0);
    const location = context.getNodeParameter('location', 0) as string;
    const filters = context.getNodeParameter('filters', 0) as Record<string, unknown>;
    const maxResults = context.getNodeParameter('maxResults', 0);
    const includeDetails = context.getNodeParameter('includeDetails', 0) as Record<string, boolean>;

    // Simulated real estate data
    const listings = [
      {
        id: 'listing_1',
        platform: 'zillow',
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          full: '123 Main St, San Francisco, CA 94102',
        },
        price: 899000,
        pricePerSqft: 899,
        beds: 3,
        baths: 2,
        sqft: 1000,
        propertyType: 'Condo',
        yearBuilt: 2010,
        lotSize: null,
        parking: 1,
        status: 'Active',
        daysOnMarket: 15,
        photos: includeDetails.photos ? [
          'https://example.com/photo1.jpg',
          'https://example.com/photo2.jpg',
        ] : undefined,
        description: 'Beautiful condo in prime location...',
        features: ['Hardwood floors', 'In-unit laundry', 'Balcony'],
        url: 'https://zillow.com/...',
        listingAgent: {
          name: 'Jane Smith',
          phone: '555-123-4567',
          company: 'Real Estate Co.',
        },
        priceHistory: includeDetails.propertyHistory ? [
          { date: '2024-01-01', event: 'Listed', price: 899000 },
          { date: '2020-05-15', event: 'Sold', price: 750000 },
        ] : undefined,
        taxInfo: includeDetails.taxInfo ? {
          annualTax: 11250,
          assessedValue: 750000,
        } : undefined,
        schools: includeDetails.schools ? [
          { name: 'Elementary School', rating: 8, distance: 0.3 },
          { name: 'Middle School', rating: 7, distance: 0.8 },
        ] : undefined,
      },
      {
        id: 'listing_2',
        platform: 'realtor',
        address: {
          street: '456 Oak Ave',
          city: 'San Francisco',
          state: 'CA',
          zip: '94110',
          full: '456 Oak Ave, San Francisco, CA 94110',
        },
        price: 1250000,
        pricePerSqft: 694,
        beds: 4,
        baths: 3,
        sqft: 1800,
        propertyType: 'House',
        yearBuilt: 1925,
        lotSize: 2500,
        parking: 2,
        status: 'Active',
        daysOnMarket: 7,
        photos: includeDetails.photos ? [
          'https://example.com/photo3.jpg',
        ] : undefined,
        url: 'https://realtor.com/...',
      },
    ];

    const result = {
      search: {
        location,
        listingType,
        filters,
        platforms,
      },
      summary: {
        totalFound: listings.length,
        priceRange: {
          min: 899000,
          max: 1250000,
          median: 1074500,
        },
        avgPricePerSqft: 796,
        avgDaysOnMarket: 11,
        byPlatform: {
          zillow: 1,
          realtor: 1,
        },
      },
      listings,
      marketInsights: {
        medianListPrice: 1100000,
        avgSaleToListRatio: 1.02,
        inventoryTrend: 'decreasing',
        daysOnMarketTrend: 'stable',
      },
      metadata: {
        scrapedAt: new Date().toISOString(),
        platformsSearched: platforms.length,
      },
    };

    return [[{ json: result }]];
  },
});

// ============================================
// SOCIAL PROFILE SCRAPER
// ============================================

export const SocialProfileScraper = createProgrammaticNode({
  name: 'SocialProfileScraper',
  displayName: 'Social Profile Scraper',
  description: 'Scrape public social media profiles',
  icon: 'user-circle',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'Social Profile Scraper' },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    { name: 'scraperApi', required: false },
  ],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 Public data only | 💰 RocketReach, Apollo for enrichment | Respect platform ToS',
    },
    {
      displayName: 'Platform',
      name: 'platform',
      type: 'options',
      options: [
        { name: 'LinkedIn', value: 'linkedin' },
        { name: 'Twitter/X', value: 'twitter' },
        { name: 'Instagram', value: 'instagram' },
        { name: 'Facebook', value: 'facebook' },
        { name: 'TikTok', value: 'tiktok' },
        { name: 'GitHub', value: 'github' },
        { name: 'YouTube', value: 'youtube' },
      ],
      default: 'linkedin',
    },
    {
      displayName: 'Profile URL or Username',
      name: 'profileId',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Data to Extract',
      name: 'extractData',
      type: 'multiOptions',
      options: [
        { name: 'Basic Info', value: 'basic' },
        { name: 'Bio/About', value: 'bio' },
        { name: 'Work Experience', value: 'experience' },
        { name: 'Education', value: 'education' },
        { name: 'Skills', value: 'skills' },
        { name: 'Connections/Followers', value: 'connections' },
        { name: 'Recent Posts', value: 'posts' },
        { name: 'Contact Info (if public)', value: 'contact' },
      ],
      default: ['basic', 'bio', 'experience'],
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Max Posts',
          name: 'maxPosts',
          type: 'number',
          default: 10,
        },
        {
          displayName: 'Include Engagement Stats',
          name: 'includeEngagement',
          type: 'boolean',
          default: true,
        },
      ],
    },
  ],
  async execute(context) {
    const platform = context.getNodeParameter('platform', 0) as string;
    const profileId = context.getNodeParameter('profileId', 0) as string;
    const extractData = context.getNodeParameter('extractData', 0) as string[];
    const options = context.getNodeParameter('options', 0) as Record<string, unknown>;

    // Simulated profile data
    const profileData: Record<string, unknown> = {
      platform,
      profileId,
      extractedAt: new Date().toISOString(),
    };

    if (extractData.includes('basic')) {
      profileData.basic = {
        name: 'John Doe',
        headline: 'Senior Software Engineer at Tech Co',
        location: 'San Francisco Bay Area',
        profileUrl: `https://${platform}.com/${profileId}`,
        profileImage: 'https://example.com/avatar.jpg',
      };
    }

    if (extractData.includes('bio')) {
      profileData.bio = 'Passionate software engineer with 10+ years of experience in building scalable systems...';
    }

    if (extractData.includes('experience')) {
      profileData.experience = [
        {
          title: 'Senior Software Engineer',
          company: 'Tech Co',
          duration: '2020 - Present',
          location: 'San Francisco, CA',
          description: 'Leading backend development...',
        },
        {
          title: 'Software Engineer',
          company: 'Startup Inc',
          duration: '2017 - 2020',
          location: 'San Francisco, CA',
        },
      ];
    }

    if (extractData.includes('education')) {
      profileData.education = [
        {
          school: 'Stanford University',
          degree: 'MS Computer Science',
          years: '2015 - 2017',
        },
      ];
    }

    if (extractData.includes('skills')) {
      profileData.skills = ['Python', 'JavaScript', 'AWS', 'Kubernetes', 'Machine Learning'];
    }

    if (extractData.includes('connections')) {
      profileData.connections = {
        count: 500,
        label: '500+ connections',
      };
    }

    if (extractData.includes('posts')) {
      profileData.posts = [
        {
          text: 'Excited to share our latest project...',
          date: '2024-01-20',
          likes: 150,
          comments: 25,
          shares: 10,
        },
      ];
    }

    if (extractData.includes('contact')) {
      profileData.contact = {
        email: 'public@example.com',
        website: 'https://johndoe.dev',
      };
    }

    return [[{ json: profileData }]];
  },
});

// ============================================
// NEWS AGGREGATOR
// ============================================

export const NewsAggregator = createProgrammaticNode({
  name: 'NewsAggregator',
  displayName: 'News Aggregator',
  description: 'Aggregate news from multiple sources on specific topics',
  icon: 'newspaper',
  group: ['scraping'],
  version: 1,
  defaults: { name: 'News Aggregator' },
  inputs: ['main'],
  outputs: ['main'],
  properties: [
    {
      displayName: 'Pricing Info',
      name: 'pricingNotice',
      type: 'notice',
      default: '',
      description: '💚 RSS feeds are free | 💰 NewsAPI from $449/mo | Google News scraping requires proxy',
    },
    {
      displayName: 'Sources',
      name: 'sources',
      type: 'multiOptions',
      options: [
        { name: 'Google News', value: 'googleNews' },
        { name: 'Bing News', value: 'bingNews' },
        { name: 'Reuters', value: 'reuters' },
        { name: 'Associated Press', value: 'ap' },
        { name: 'BBC', value: 'bbc' },
        { name: 'CNN', value: 'cnn' },
        { name: 'TechCrunch', value: 'techcrunch' },
        { name: 'The Verge', value: 'verge' },
        { name: 'Hacker News', value: 'hackernews' },
        { name: 'Reddit News', value: 'reddit' },
        { name: 'Custom RSS', value: 'rss' },
      ],
      default: ['googleNews', 'bingNews'],
    },
    {
      displayName: 'Topic/Keywords',
      name: 'keywords',
      type: 'string',
      default: '',
    },
    {
      displayName: 'Category',
      name: 'category',
      type: 'options',
      options: [
        { name: 'All', value: 'all' },
        { name: 'Business', value: 'business' },
        { name: 'Technology', value: 'technology' },
        { name: 'Science', value: 'science' },
        { name: 'Health', value: 'health' },
        { name: 'Sports', value: 'sports' },
        { name: 'Entertainment', value: 'entertainment' },
        { name: 'Politics', value: 'politics' },
        { name: 'World', value: 'world' },
      ],
      default: 'all',
    },
    {
      displayName: 'Time Range',
      name: 'timeRange',
      type: 'options',
      options: [
        { name: 'Any Time', value: 'any' },
        { name: 'Past Hour', value: '1h' },
        { name: 'Past 24 Hours', value: '24h' },
        { name: 'Past Week', value: '7d' },
        { name: 'Past Month', value: '30d' },
      ],
      default: '24h',
    },
    {
      displayName: 'Language',
      name: 'language',
      type: 'options',
      options: [
        { name: 'English', value: 'en' },
        { name: 'Spanish', value: 'es' },
        { name: 'French', value: 'fr' },
        { name: 'German', value: 'de' },
        { name: 'Chinese', value: 'zh' },
        { name: 'Japanese', value: 'ja' },
      ],
      default: 'en',
    },
    {
      displayName: 'Max Articles',
      name: 'maxArticles',
      type: 'number',
      default: 50,
    },
    {
      displayName: 'Options',
      name: 'options',
      type: 'collection',
      placeholder: 'Add Option',
      default: {},
      options: [
        {
          displayName: 'Extract Full Content',
          name: 'extractContent',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Deduplicate Similar',
          name: 'deduplicate',
          type: 'boolean',
          default: true,
        },
        {
          displayName: 'Analyze Sentiment',
          name: 'analyzeSentiment',
          type: 'boolean',
          default: false,
        },
        {
          displayName: 'Group by Topic',
          name: 'groupByTopic',
          type: 'boolean',
          default: false,
        },
      ],
    },
  ],
  async execute(context) {
    const sources = context.getNodeParameter('sources', 0) as string[];
    const keywords = context.getNodeParameter('keywords', 0) as string;
    const category = context.getNodeParameter('category', 0);
    const timeRange = context.getNodeParameter('timeRange', 0);
    const language = context.getNodeParameter('language', 0);
    const maxArticles = context.getNodeParameter('maxArticles', 0);
    const options = context.getNodeParameter('options', 0) as Record<string, boolean>;

    // Simulated news aggregation
    const articles = [
      {
        id: 'article_1',
        title: 'Breaking: Major Tech Announcement',
        source: 'TechCrunch',
        author: 'John Reporter',
        publishedAt: new Date().toISOString(),
        url: 'https://techcrunch.com/article/1',
        imageUrl: 'https://example.com/image1.jpg',
        description: 'A major technology company announced today...',
        content: options.extractContent ? 'Full article content here...' : undefined,
        sentiment: options.analyzeSentiment ? { score: 0.7, label: 'positive' } : undefined,
        keywords: ['technology', 'announcement', 'innovation'],
      },
      {
        id: 'article_2',
        title: 'Industry Analysis: Q4 Results',
        source: 'Reuters',
        author: 'Jane Analyst',
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        url: 'https://reuters.com/article/2',
        description: 'Companies across the sector reported strong Q4...',
        sentiment: options.analyzeSentiment ? { score: 0.5, label: 'neutral' } : undefined,
      },
    ];

    const result = {
      search: {
        keywords,
        category,
        timeRange,
        language,
        sources,
      },
      summary: {
        totalArticles: articles.length,
        bySource: {
          TechCrunch: 1,
          Reuters: 1,
        },
        sentimentOverview: options.analyzeSentiment ? {
          positive: 1,
          neutral: 1,
          negative: 0,
        } : undefined,
      },
      articles,
      topics: options.groupByTopic ? [
        { topic: 'Technology', articleCount: 2 },
      ] : undefined,
      metadata: {
        aggregatedAt: new Date().toISOString(),
        sourcesSearched: sources.length,
        duplicatesRemoved: options.deduplicate ? 3 : 0,
      },
    };

    return [[{ json: result }]];
  },
});
