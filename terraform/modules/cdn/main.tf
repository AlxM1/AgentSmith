# AWS CloudFront CDN Module for AgentSmith
# Provides global content delivery with edge caching

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
}

variable "origin_domain" {
  description = "Origin server domain (ALB/NLB endpoint)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100" # US, Canada, Europe
}

variable "waf_web_acl_id" {
  description = "WAF Web ACL ID for protection"
  type        = string
  default     = null
}

variable "enable_logging" {
  description = "Enable access logging"
  type        = bool
  default     = true
}

variable "log_bucket" {
  description = "S3 bucket for access logs"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# Locals
locals {
  s3_origin_id     = "agentsmith-static-origin"
  alb_origin_id    = "agentsmith-api-origin"
  default_tags = merge(var.tags, {
    Application = "agentsmith"
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# S3 bucket for static assets (optional)
resource "aws_s3_bucket" "static_assets" {
  bucket = "agentsmith-static-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = local.default_tags
}

resource "aws_s3_bucket_versioning" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "static" {
  name                              = "agentsmith-static-oac-${var.environment}"
  description                       = "OAC for AgentSmith static assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

# Cache policy for static assets
resource "aws_cloudfront_cache_policy" "static" {
  name        = "agentsmith-static-${var.environment}"
  comment     = "Cache policy for static assets"
  default_ttl = 86400    # 1 day
  max_ttl     = 31536000 # 1 year
  min_ttl     = 1

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Cache policy for API (no caching)
resource "aws_cloudfront_cache_policy" "api" {
  name        = "agentsmith-api-${var.environment}"
  comment     = "No-cache policy for API endpoints"
  default_ttl = 0
  max_ttl     = 0
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "all"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = [
          "Authorization",
          "Content-Type",
          "X-Requested-With",
          "X-API-Key",
          "X-Workspace-Id"
        ]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

# Origin request policy for API
resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "agentsmith-api-origin-${var.environment}"
  comment = "Origin request policy for API"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "Authorization",
        "Content-Type",
        "X-Requested-With",
        "X-API-Key",
        "X-Workspace-Id",
        "Origin",
        "Accept",
        "Accept-Language",
        "User-Agent"
      ]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

# Response headers policy
resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "agentsmith-security-headers-${var.environment}"
  comment = "Security headers policy"

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }

  cors_config {
    access_control_allow_credentials = true
    access_control_max_age_sec       = 86400

    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    }
    access_control_allow_origins {
      items = ["https://${var.domain_name}"]
    }
    access_control_expose_headers {
      items = ["X-Request-Id", "X-RateLimit-Remaining"]
    }
    origin_override = true
  }
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "AgentSmith CDN - ${var.environment}"
  default_root_object = "index.html"
  price_class         = var.price_class
  web_acl_id          = var.waf_web_acl_id
  http_version        = "http2and3"

  aliases = [
    var.domain_name,
    "cdn.${var.domain_name}"
  ]

  # S3 origin for static assets
  origin {
    domain_name              = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
  }

  # ALB origin for API
  origin {
    domain_name = var.origin_domain
    origin_id   = local.alb_origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_verify.result
    }
  }

  # Default behavior (serve from S3)
  default_cache_behavior {
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = local.s3_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.static.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.url_rewrite.arn
    }
  }

  # API behavior (no caching, forward to ALB)
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = local.alb_origin_id
    viewer_protocol_policy   = "https-only"
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.api.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # WebSocket behavior
  ordered_cache_behavior {
    path_pattern             = "/ws/*"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = local.alb_origin_id
    viewer_protocol_policy   = "https-only"
    cache_policy_id          = aws_cloudfront_cache_policy.api.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }

  # Webhook behavior
  ordered_cache_behavior {
    path_pattern             = "/webhook/*"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = local.alb_origin_id
    viewer_protocol_policy   = "https-only"
    cache_policy_id          = aws_cloudfront_cache_policy.api.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.api.id
  }

  # Custom error responses (SPA routing)
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  # Geo restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL certificate
  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Logging
  dynamic "logging_config" {
    for_each = var.enable_logging && var.log_bucket != "" ? [1] : []
    content {
      bucket          = "${var.log_bucket}.s3.amazonaws.com"
      prefix          = "cloudfront/${var.environment}/"
      include_cookies = false
    }
  }

  tags = local.default_tags
}

# CloudFront function for URL rewriting (SPA support)
resource "aws_cloudfront_function" "url_rewrite" {
  name    = "agentsmith-url-rewrite-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "URL rewriting for SPA"
  publish = true

  code = <<-EOF
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // Check if request is for a file (has extension)
      if (uri.match(/\.[a-zA-Z0-9]+$/)) {
        return request;
      }

      // Add cache busting for versioned assets
      if (uri.match(/\.(js|css)$/) && request.querystring && request.querystring.v) {
        // Already has version, continue
        return request;
      }

      // For SPA routes without extension, serve index.html
      if (!uri.match(/\.[a-zA-Z0-9]+$/) && !uri.startsWith('/api/') && !uri.startsWith('/ws/')) {
        request.uri = '/index.html';
      }

      return request;
    }
  EOF
}

# Origin verification secret
resource "random_password" "origin_verify" {
  length  = 32
  special = false
}

# Data sources
data "aws_caller_identity" "current" {}

# Outputs
output "distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "distribution_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.main.arn
}

output "static_bucket_name" {
  description = "S3 bucket name for static assets"
  value       = aws_s3_bucket.static_assets.id
}

output "static_bucket_arn" {
  description = "S3 bucket ARN for static assets"
  value       = aws_s3_bucket.static_assets.arn
}

output "origin_verify_header" {
  description = "Origin verification header value (store securely)"
  value       = random_password.origin_verify.result
  sensitive   = true
}
