/**
 * GEO Node Execution Logic
 *
 * Implements the actual processing for GEO optimization nodes
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GEOAnalysisResult {
  // Readability metrics
  readability: {
    fleschKincaid: number;
    gunningFog: number;
    avgSentenceLength: number;
    avgParagraphLength: number;
    score: number; // 0-100
  };

  // Structure analysis
  structure: {
    headingCount: { h1: number; h2: number; h3: number; h4: number };
    listCount: number;
    faqPatternsFound: number;
    definitionsFound: number;
    tableCount: number;
    score: number; // 0-100
  };

  // E-E-A-T signals
  eeat: {
    authorAttributionFound: boolean;
    authorCredentials: string[];
    citationCount: number;
    statisticsCount: number;
    expertQuotesCount: number;
    dateIndicators: boolean;
    sourceAuthority: string[]; // domains cited
    score: number; // 0-100
  };

  // AI-friendliness
  aiFriendliness: {
    directAnswerPatterns: number;
    semanticClarity: number; // 0-100
    entityDensity: number;
    citationReadySnippets: number;
    score: number; // 0-100
  };

  // Overall
  overallScore: number; // 0-100
  recommendations: GEORecommendation[];
}

export interface GEORecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  estimatedImpact: string; // e.g., "+15% visibility"
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface CompetitorAnalysis {
  rank: number;
  name: string;
  domain: string;
  distance?: number; // km, for geolocation
  proximity?: string; // "0.5 km", for display

  // Scores
  geoScore: number;
  aiVisibilityScore: number;
  contentScore: number;
  eeatScore: number;
  schemaScore: number;

  // Details
  strengths: string[];
  weaknesses: string[];
  contentTopics: string[];
  schemaTypes: string[];
  socialProfiles: string[];
  reviewRating?: number;
  reviewCount?: number;

  // Comparison to you
  comparison: {
    betterAt: string[];
    worseAt: string[];
    opportunities: string[];
  };
}

export interface AIVisibilityResult {
  platform: string;
  query: string;
  mentioned: boolean;
  mentionType: 'recommendation' | 'citation' | 'reference' | 'comparison' | 'none';
  position: number; // 0 = not mentioned, 1 = first, etc.
  sentiment: 'positive' | 'neutral' | 'negative';
  context: string; // The snippet where mentioned
  competitorsMentioned: string[];
}

export interface SchemaOutput {
  type: string;
  jsonLd: object;
  scriptTag: string;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// ============================================================================
// READABILITY CALCULATIONS
// ============================================================================

export function calculateFleschKincaid(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease formula
  const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateGunningFog(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const complexWords = words.filter(w => countSyllables(w) >= 3).length;

  if (sentences.length === 0 || words.length === 0) return 0;

  const avgSentenceLength = words.length / sentences.length;
  const percentComplexWords = (complexWords / words.length) * 100;

  // Gunning Fog formula
  const score = 0.4 * (avgSentenceLength + percentComplexWords);
  return Math.round(score * 10) / 10;
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');

  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

// ============================================================================
// STRUCTURE ANALYSIS
// ============================================================================

export function analyzeStructure(html: string): GEOAnalysisResult['structure'] {
  const headingCount = {
    h1: (html.match(/<h1[^>]*>/gi) || []).length,
    h2: (html.match(/<h2[^>]*>/gi) || []).length,
    h3: (html.match(/<h3[^>]*>/gi) || []).length,
    h4: (html.match(/<h4[^>]*>/gi) || []).length,
  };

  const listCount = (html.match(/<(ul|ol)[^>]*>/gi) || []).length;
  const tableCount = (html.match(/<table[^>]*>/gi) || []).length;

  // FAQ pattern detection
  const faqPatterns = [
    /<dt[^>]*>.*?<\/dt>/gi,
    /\?<\/h[2-4]>/gi,
    /"@type"\s*:\s*"FAQPage"/gi,
    /class="[^"]*faq[^"]*"/gi,
  ];
  const faqPatternsFound = faqPatterns.reduce(
    (sum, pattern) => sum + (html.match(pattern) || []).length,
    0
  );

  // Definition detection
  const definitionPatterns = [
    /<dfn[^>]*>/gi,
    /\bis defined as\b/gi,
    /\bmeans\b.*\bwhen\b/gi,
    /\brefers to\b/gi,
  ];
  const definitionsFound = definitionPatterns.reduce(
    (sum, pattern) => sum + (html.match(pattern) || []).length,
    0
  );

  // Calculate structure score
  let score = 50; // Base score

  // Heading hierarchy bonus
  if (headingCount.h1 === 1) score += 10;
  if (headingCount.h2 >= 3) score += 10;
  if (headingCount.h3 >= 2) score += 5;

  // List usage bonus
  if (listCount >= 2) score += 10;

  // FAQ bonus
  if (faqPatternsFound > 0) score += 10;

  // Definition bonus
  if (definitionsFound > 0) score += 5;

  return {
    headingCount,
    listCount,
    faqPatternsFound,
    definitionsFound,
    tableCount,
    score: Math.min(100, score),
  };
}

// ============================================================================
// E-E-A-T SIGNAL DETECTION
// ============================================================================

export function analyzeEEAT(html: string, text: string): GEOAnalysisResult['eeat'] {
  // Author detection
  const authorPatterns = [
    /by\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
    /author[":]\s*["']?([^"'<]+)/gi,
    /<meta[^>]*name="author"[^>]*content="([^"]+)"/gi,
    /class="[^"]*author[^"]*"[^>]*>([^<]+)/gi,
  ];
  const authorAttributionFound = authorPatterns.some(p => p.test(html) || p.test(text));

  // Credentials detection
  const credentialPatterns = [
    /\b(PhD|MD|MBA|CPA|JD|RN|PE|PMP)\b/g,
    /\b(certified|licensed|accredited)\b/gi,
    /\b(professor|doctor|expert|specialist|analyst)\b/gi,
    /\b(\d+\+?\s*years?\s*(of\s+)?experience)\b/gi,
  ];
  const authorCredentials: string[] = [];
  credentialPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) authorCredentials.push(...matches);
  });

  // Citation detection
  const citationPatterns = [
    /\[(\d+)\]/g, // [1], [2], etc.
    /\(([A-Z][a-z]+,?\s*\d{4})\)/g, // (Smith, 2024)
    /according to\s+([^,\.]+)/gi,
    /<a[^>]*href="https?:\/\/[^"]+"/gi,
    /source:\s*[^<\n]+/gi,
  ];
  let citationCount = 0;
  citationPatterns.forEach(pattern => {
    const matches = text.match(pattern) || html.match(pattern);
    if (matches) citationCount += matches.length;
  });

  // Statistics detection
  const statisticsPatterns = [
    /\b\d+(\.\d+)?%/g,
    /\$\d+(\.\d+)?[KMB]?/g,
    /\b\d+(\.\d+)?\s*(million|billion|thousand)/gi,
    /\b(study|research|survey|report)\s+found/gi,
    /\b(according to|based on)\s+(a|the)?\s*(study|research|data)/gi,
  ];
  let statisticsCount = 0;
  statisticsPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) statisticsCount += matches.length;
  });

  // Expert quotes detection
  const quotePatterns = [
    /"[^"]{20,}"/g,
    /['"][^'"]{20,}['"]\s*[-–—]\s*[A-Z][a-z]+/g,
    /<blockquote[^>]*>/gi,
  ];
  let expertQuotesCount = 0;
  quotePatterns.forEach(pattern => {
    const matches = html.match(pattern) || text.match(pattern);
    if (matches) expertQuotesCount += matches.length;
  });

  // Date detection
  const datePatterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}/g,
    /\b(updated|published|reviewed)[:.]?\s*(on)?\s*\d/gi,
    /<time[^>]*datetime/gi,
  ];
  const dateIndicators = datePatterns.some(p => p.test(html) || p.test(text));

  // Extract source domains
  const linkMatches = html.match(/href="(https?:\/\/[^/"]+)/gi) || [];
  const sourceAuthority = [...new Set(
    linkMatches
      .map(m => m.replace(/href="https?:\/\//, '').replace(/".*/, ''))
      .filter(d => !d.includes('example.com'))
      .slice(0, 10)
  )];

  // Calculate E-E-A-T score
  let score = 30; // Base score

  if (authorAttributionFound) score += 15;
  if (authorCredentials.length > 0) score += 10;
  if (citationCount >= 3) score += 15;
  if (statisticsCount >= 2) score += 15;
  if (expertQuotesCount >= 1) score += 10;
  if (dateIndicators) score += 5;

  return {
    authorAttributionFound,
    authorCredentials: [...new Set(authorCredentials)].slice(0, 5),
    citationCount,
    statisticsCount,
    expertQuotesCount,
    dateIndicators,
    sourceAuthority,
    score: Math.min(100, score),
  };
}

// ============================================================================
// AI-FRIENDLINESS ANALYSIS
// ============================================================================

export function analyzeAIFriendliness(text: string): GEOAnalysisResult['aiFriendliness'] {
  // Direct answer patterns
  const directAnswerPatterns = [
    /^[A-Z][^.!?]*\s+(is|are|was|were|means|refers to)\s+/gm,
    /\bthe answer is\b/gi,
    /\bin short,?\b/gi,
    /\bto summarize,?\b/gi,
    /\bthe key (point|takeaway) is\b/gi,
  ];
  let directAnswerPatternCount = 0;
  directAnswerPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) directAnswerPatternCount += matches.length;
  });

  // Semantic clarity (simple heuristics)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;

  // Ideal sentence length is 15-20 words
  const sentenceScore = avgWords >= 10 && avgWords <= 25 ? 80 :
                        avgWords > 25 ? Math.max(40, 100 - (avgWords - 25) * 3) :
                        Math.max(50, avgWords * 5);

  // Passive voice detection (reduces clarity)
  const passivePatterns = /\b(is|are|was|were|been|being)\s+\w+ed\b/gi;
  const passiveCount = (text.match(passivePatterns) || []).length;
  const passivePenalty = Math.min(30, passiveCount * 3);

  const semanticClarity = Math.max(0, Math.min(100, sentenceScore - passivePenalty));

  // Entity density (nouns/proper nouns per 100 words)
  const words = text.split(/\s+/);
  const capitalizedWords = words.filter(w => /^[A-Z][a-z]+/.test(w) && w.length > 2);
  const entityDensity = Math.round((capitalizedWords.length / words.length) * 100);

  // Citation-ready snippets (complete thoughts that could be quoted)
  const sentences2 = text.split(/[.!?]+/).filter(s => {
    const trimmed = s.trim();
    return trimmed.length >= 50 && trimmed.length <= 200;
  });
  const citationReadySnippets = sentences2.length;

  // Calculate overall score
  const score = Math.round(
    (directAnswerPatternCount > 0 ? 25 : 0) +
    (semanticClarity * 0.4) +
    (entityDensity > 5 && entityDensity < 20 ? 15 : 5) +
    (citationReadySnippets >= 5 ? 20 : citationReadySnippets * 4)
  );

  return {
    directAnswerPatterns: directAnswerPatternCount,
    semanticClarity,
    entityDensity,
    citationReadySnippets,
    score: Math.min(100, score),
  };
}

// ============================================================================
// CONTENT OPTIMIZATION PROMPTS
// ============================================================================

export const optimizationPrompts = {
  statistics: `Analyze the following content and add relevant, factual statistics to support key claims.

RULES:
- Only add real, verifiable statistics from reputable sources
- Include the source for each statistic
- Format: "According to [Source], [statistic]."
- Add 3-5 statistics where appropriate
- Don't fabricate data

CONTENT:
{{content}}

Return the enhanced content with statistics added naturally.`,

  citations: `Analyze the following content and add citations to authoritative sources.

RULES:
- Add citations to support factual claims
- Use authoritative sources (academic papers, industry reports, official docs)
- Format: [Source Name](URL) or "According to [Source]..."
- Add 3-5 relevant citations
- Only cite real, verifiable sources

CONTENT:
{{content}}

Return the enhanced content with citations added.`,

  quotes: `Analyze the following content and add relevant expert quotes.

RULES:
- Add quotes from recognized experts in the field
- Use real quotes from real people (verifiable)
- Format: "Quote here," says [Name], [Title/Credentials].
- Add 2-3 impactful quotes
- Ensure quotes are relevant to the content

TOPIC: {{topic}}

CONTENT:
{{content}}

Return the enhanced content with expert quotes added.`,

  authoritative: `Rewrite the following content with a more authoritative, expert tone.

RULES:
- Use confident, definitive language
- Remove hedging words (maybe, perhaps, might)
- Use active voice
- Demonstrate expertise through precise terminology
- Maintain accuracy - don't overstate claims
- Keep the same meaning and structure

CONTENT:
{{content}}

Return the rewritten content with authoritative tone.`,

  fluency: `Improve the fluency and readability of the following content.

RULES:
- Improve sentence flow and transitions
- Break up overly long sentences (aim for 15-20 words)
- Ensure logical paragraph progression
- Add transition words where needed
- Maintain the original meaning
- Target Flesch-Kincaid score of 60-70

CONTENT:
{{content}}

Return the improved content with better fluency.`,

  faq: `Generate a FAQ section based on the following content.

RULES:
- Create 5-7 relevant questions users would ask
- Provide clear, concise answers (50-100 words each)
- Use natural question phrasing
- Cover the main topics in the content
- Format as Q: and A:

TOPIC: {{topic}}

CONTENT:
{{content}}

Return the FAQ section.`,
};

// ============================================================================
// SCHEMA GENERATORS
// ============================================================================

export function generateArticleSchema(data: {
  title: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: { name: string; url?: string };
  publisher: { name: string; logo?: string };
}): SchemaOutput {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.title,
    description: data.description,
    url: data.url,
    image: data.image,
    datePublished: data.datePublished,
    dateModified: data.dateModified || data.datePublished,
    author: {
      '@type': 'Person',
      name: data.author.name,
      url: data.author.url,
    },
    publisher: {
      '@type': 'Organization',
      name: data.publisher.name,
      logo: data.publisher.logo ? {
        '@type': 'ImageObject',
        url: data.publisher.logo,
      } : undefined,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': data.url,
    },
  };

  return {
    type: 'Article',
    jsonLd,
    scriptTag: `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`,
    validation: validateSchema(jsonLd),
  };
}

export function generateFAQSchema(faqs: { question: string; answer: string }[]): SchemaOutput {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return {
    type: 'FAQPage',
    jsonLd,
    scriptTag: `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`,
    validation: validateSchema(jsonLd),
  };
}

export function generateOrganizationSchema(data: {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  contactPoint?: { telephone: string; contactType: string };
}): SchemaOutput {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    url: data.url,
    logo: data.logo,
    description: data.description,
    sameAs: data.sameAs,
    contactPoint: data.contactPoint ? {
      '@type': 'ContactPoint',
      telephone: data.contactPoint.telephone,
      contactType: data.contactPoint.contactType,
    } : undefined,
  };

  return {
    type: 'Organization',
    jsonLd,
    scriptTag: `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`,
    validation: validateSchema(jsonLd),
  };
}

export function generateLocalBusinessSchema(data: {
  name: string;
  description?: string;
  url: string;
  telephone?: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  geo?: { latitude: number; longitude: number };
  openingHours?: string[];
  priceRange?: string;
  image?: string;
  aggregateRating?: { ratingValue: number; reviewCount: number };
}): SchemaOutput {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: data.name,
    description: data.description,
    url: data.url,
    telephone: data.telephone,
    image: data.image,
    priceRange: data.priceRange,
    address: {
      '@type': 'PostalAddress',
      ...data.address,
    },
    geo: data.geo ? {
      '@type': 'GeoCoordinates',
      latitude: data.geo.latitude,
      longitude: data.geo.longitude,
    } : undefined,
    openingHoursSpecification: data.openingHours,
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
    } : undefined,
  };

  return {
    type: 'LocalBusiness',
    jsonLd,
    scriptTag: `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`,
    validation: validateSchema(jsonLd),
  };
}

function validateSchema(schema: object): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!('@context' in schema)) {
    errors.push('Missing @context');
  }
  if (!('@type' in schema)) {
    errors.push('Missing @type');
  }

  // Check for empty required fields based on type
  const type = (schema as any)['@type'];
  if (type === 'Article') {
    if (!(schema as any).headline) errors.push('Article missing headline');
    if (!(schema as any).author) warnings.push('Article missing author (E-E-A-T signal)');
    if (!(schema as any).datePublished) warnings.push('Article missing datePublished');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// COMPETITOR ANALYSIS HELPERS
// ============================================================================

export async function findLocalCompetitors(
  apiKey: string,
  location: { lat: number; lng: number },
  businessType: string,
  radius: number = 25000 // meters
): Promise<Array<{ name: string; address: string; rating?: number; distance: number }>> {
  // This would call Google Places API
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
    `location=${location.lat},${location.lng}&radius=${radius}&type=${businessType}&key=${apiKey}`;

  // Return mock structure - actual implementation would make API call
  return [];
}

export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  // Haversine formula for calculating distance between two points
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export function rankCompetitorsByProximity(
  competitors: CompetitorAnalysis[],
  userLat: number,
  userLng: number
): CompetitorAnalysis[] {
  // Sort by distance (assuming distance is already calculated)
  return competitors.sort((a, b) => (a.distance || 999) - (b.distance || 999));
}

// ============================================================================
// AI VISIBILITY TEST PROMPTS
// ============================================================================

export const visibilityTestPrompts = {
  mention: `I'm researching {{query}}. What are the best options available?`,

  recommendation: `What would you recommend for {{query}}? Please provide specific company or product recommendations.`,

  comparison: `Compare the top {{category}} options. Which companies or products are leaders in this space?`,

  bestOf: `What are the best {{category}} in {{location}}?`,
};

export function parseVisibilityResponse(
  response: string,
  brandName: string,
  competitors: string[]
): {
  mentioned: boolean;
  mentionType: AIVisibilityResult['mentionType'];
  position: number;
  sentiment: AIVisibilityResult['sentiment'];
  competitorsMentioned: string[];
} {
  const lowerResponse = response.toLowerCase();
  const lowerBrand = brandName.toLowerCase();

  // Check if brand is mentioned
  const mentioned = lowerResponse.includes(lowerBrand);

  // Find position
  let position = 0;
  if (mentioned) {
    const beforeMention = lowerResponse.substring(0, lowerResponse.indexOf(lowerBrand));
    const numbersOrBullets = beforeMention.match(/(\d+\.|•|-)/g);
    position = numbersOrBullets ? numbersOrBullets.length + 1 : 1;
  }

  // Determine mention type
  let mentionType: AIVisibilityResult['mentionType'] = 'none';
  if (mentioned) {
    if (/recommend|best|top pick|leading/i.test(response)) {
      mentionType = 'recommendation';
    } else if (/according to|source|cited|reference/i.test(response)) {
      mentionType = 'citation';
    } else if (/compared to|versus|vs\.|alternative/i.test(response)) {
      mentionType = 'comparison';
    } else {
      mentionType = 'reference';
    }
  }

  // Sentiment analysis (basic)
  let sentiment: AIVisibilityResult['sentiment'] = 'neutral';
  if (mentioned) {
    const brandContext = extractContext(response, brandName, 100);
    const positiveWords = /excellent|great|best|leading|innovative|reliable|trusted|recommended/i;
    const negativeWords = /poor|bad|avoid|issues|problems|expensive|limited|outdated/i;

    if (positiveWords.test(brandContext)) sentiment = 'positive';
    else if (negativeWords.test(brandContext)) sentiment = 'negative';
  }

  // Check competitors
  const competitorsMentioned = competitors.filter(c =>
    lowerResponse.includes(c.toLowerCase())
  );

  return {
    mentioned,
    mentionType,
    position,
    sentiment,
    competitorsMentioned,
  };
}

function extractContext(text: string, keyword: string, contextLength: number): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) return '';

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + keyword.length + contextLength);

  return text.substring(start, end);
}

// ============================================================================
// GEO SCORE CALCULATION
// ============================================================================

export function calculateGEOScore(analysis: GEOAnalysisResult): number {
  const weights = {
    readability: 0.20,
    structure: 0.15,
    eeat: 0.25,
    citations: 0.15,
    schema: 0.10,
    aiFriendly: 0.15,
  };

  // For now, we combine eeat and citations into eeat score
  // Schema score would need separate analysis

  const weightedScore =
    analysis.readability.score * weights.readability +
    analysis.structure.score * weights.structure +
    analysis.eeat.score * (weights.eeat + weights.citations) +
    analysis.aiFriendliness.score * weights.aiFriendly +
    50 * weights.schema; // Default schema score

  return Math.round(weightedScore);
}

export function generateRecommendations(analysis: GEOAnalysisResult): GEORecommendation[] {
  const recommendations: GEORecommendation[] = [];

  // Readability recommendations
  if (analysis.readability.fleschKincaid < 50) {
    recommendations.push({
      priority: 'high',
      category: 'Readability',
      issue: `Low readability score (${analysis.readability.fleschKincaid})`,
      recommendation: 'Simplify sentence structure. Aim for 15-20 words per sentence. Use shorter words where possible.',
      estimatedImpact: '+10-15% AI comprehension',
      difficulty: 'medium',
    });
  }

  // E-E-A-T recommendations
  if (!analysis.eeat.authorAttributionFound) {
    recommendations.push({
      priority: 'critical',
      category: 'E-E-A-T',
      issue: 'No author attribution found',
      recommendation: 'Add clear author byline with credentials. Include author bio with expertise indicators.',
      estimatedImpact: '+20% trust signals',
      difficulty: 'easy',
    });
  }

  if (analysis.eeat.citationCount < 3) {
    recommendations.push({
      priority: 'high',
      category: 'Citations',
      issue: `Low citation count (${analysis.eeat.citationCount})`,
      recommendation: 'Add 3-5 citations to authoritative sources. Use academic papers, industry reports, or official documentation.',
      estimatedImpact: '+31% visibility (Princeton study)',
      difficulty: 'medium',
    });
  }

  if (analysis.eeat.statisticsCount < 2) {
    recommendations.push({
      priority: 'high',
      category: 'Statistics',
      issue: `Low statistics count (${analysis.eeat.statisticsCount})`,
      recommendation: 'Add relevant statistics to support claims. Include percentages, numbers, and data points from credible sources.',
      estimatedImpact: '+40% visibility (Princeton study)',
      difficulty: 'medium',
    });
  }

  // Structure recommendations
  if (analysis.structure.faqPatternsFound === 0) {
    recommendations.push({
      priority: 'medium',
      category: 'Structure',
      issue: 'No FAQ section detected',
      recommendation: 'Add a FAQ section with 5-7 common questions. This improves direct answer eligibility.',
      estimatedImpact: '+15% featured snippet potential',
      difficulty: 'easy',
    });
  }

  // AI-friendliness recommendations
  if (analysis.aiFriendliness.directAnswerPatterns < 2) {
    recommendations.push({
      priority: 'medium',
      category: 'AI-Friendliness',
      issue: 'Few direct answer patterns',
      recommendation: 'Start key sections with direct definitions. Use "X is..." or "X refers to..." patterns.',
      estimatedImpact: '+10% citation-readiness',
      difficulty: 'easy',
    });
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}
