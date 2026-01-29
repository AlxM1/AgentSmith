/**
 * GEO (Generative Engine Optimization) Module
 *
 * Complete toolkit for optimizing content for AI search engines
 *
 * Nodes:
 * - GEO Content Analyzer - Analyze content for GEO readiness
 * - GEO Content Optimizer - Optimize using Princeton research methods
 * - GEO Schema Generator - Generate AI-optimized structured data
 * - GEO AI Visibility Checker - Test visibility across AI platforms
 * - GEO Competitor Analyzer - Analyze top 10 competitors by geolocation
 * - GEO Score Calculator - Calculate comprehensive GEO scores
 * - GEO Full Audit - Complete GEO audit workflow
 */

// Node definitions
export {
  GEOContentAnalyzer,
  GEOContentOptimizer,
  GEOSchemaGenerator,
  GEOVisibilityChecker,
  GEOCompetitorAnalyzer,
  GEOScoreCalculator,
  GEOFullAudit,
  geoNodes,
} from './GEO';

// Credential definitions
export {
  PerplexityApiCredential,
  SerpApiCredential,
  GooglePlacesApiCredential,
  TextRazorApiCredential,
  FraseApiCredential,
  OtterlyApiCredential,
  DataForSeoApiCredential,
  BrightDataApiCredential,
  geoCredentials,
} from './GEOCredentials';

// Execution logic and utilities
export {
  // Types
  type GEOAnalysisResult,
  type GEORecommendation,
  type CompetitorAnalysis,
  type AIVisibilityResult,
  type SchemaOutput,

  // Analysis functions
  calculateFleschKincaid,
  calculateGunningFog,
  analyzeStructure,
  analyzeEEAT,
  analyzeAIFriendliness,

  // Optimization
  optimizationPrompts,

  // Schema generation
  generateArticleSchema,
  generateFAQSchema,
  generateOrganizationSchema,
  generateLocalBusinessSchema,

  // Competitor analysis
  findLocalCompetitors,
  calculateDistance,
  rankCompetitorsByProximity,

  // AI visibility
  visibilityTestPrompts,
  parseVisibilityResponse,

  // Scoring
  calculateGEOScore,
  generateRecommendations,
} from './GEOExecutor';
