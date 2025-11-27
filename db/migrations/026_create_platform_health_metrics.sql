-- Migration: Create Platform Health Metrics tables
-- Per Specification Section 4.3.G (Analytics & Reports - Platform health)
-- Tracks: API response times, Error rates, Storage usage, Video hosting costs

-- API Metrics table - stores aggregated API performance data
CREATE TABLE api_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(255) NOT NULL,           -- API endpoint path (e.g., /api/offers)
  method VARCHAR(10) NOT NULL,              -- HTTP method (GET, POST, etc.)
  date DATE NOT NULL,                       -- Aggregation date
  hour INTEGER NOT NULL DEFAULT 0,          -- Hour of day (0-23) for hourly aggregation
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  error_requests INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms DECIMAL(10, 2) DEFAULT 0,  -- Average response time
  min_response_time_ms INTEGER DEFAULT 0,          -- Minimum response time
  max_response_time_ms INTEGER DEFAULT 0,          -- Maximum response time
  p50_response_time_ms INTEGER DEFAULT 0,          -- 50th percentile (median)
  p95_response_time_ms INTEGER DEFAULT 0,          -- 95th percentile
  p99_response_time_ms INTEGER DEFAULT 0,          -- 99th percentile
  error_4xx_count INTEGER DEFAULT 0,               -- Client error count
  error_5xx_count INTEGER DEFAULT 0,               -- Server error count
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(endpoint, method, date, hour)
);

-- Error logs table - stores individual error occurrences for analysis
CREATE TABLE api_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  request_id VARCHAR(100),
  user_id VARCHAR(255),                           -- User who triggered the error (if authenticated)
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_body JSONB,                             -- Sanitized request body (no sensitive data)
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Storage metrics table - tracks storage usage over time
CREATE TABLE storage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_files INTEGER NOT NULL DEFAULT 0,          -- Total number of files
  total_storage_bytes BIGINT NOT NULL DEFAULT 0,   -- Total storage in bytes
  video_files INTEGER NOT NULL DEFAULT 0,          -- Number of video files
  video_storage_bytes BIGINT NOT NULL DEFAULT 0,   -- Video storage in bytes
  image_files INTEGER NOT NULL DEFAULT 0,          -- Number of image files
  image_storage_bytes BIGINT NOT NULL DEFAULT 0,   -- Image storage in bytes
  document_files INTEGER NOT NULL DEFAULT 0,       -- Number of document files
  document_storage_bytes BIGINT NOT NULL DEFAULT 0,-- Document storage in bytes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Video hosting costs table - tracks estimated video hosting costs
CREATE TABLE video_hosting_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_videos INTEGER NOT NULL DEFAULT 0,
  total_video_storage_gb DECIMAL(12, 4) NOT NULL DEFAULT 0,
  total_bandwidth_gb DECIMAL(12, 4) NOT NULL DEFAULT 0,       -- Estimated bandwidth used
  storage_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,         -- Estimated storage cost
  bandwidth_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,       -- Estimated bandwidth cost
  transcoding_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,     -- Estimated transcoding cost
  total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,           -- Total estimated cost
  cost_per_video_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,       -- Average cost per video
  views_count INTEGER NOT NULL DEFAULT 0,                      -- Total video views
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform health snapshots - periodic overall health status
CREATE TABLE platform_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  overall_health_score INTEGER NOT NULL DEFAULT 100,           -- 0-100 health score
  api_health_score INTEGER NOT NULL DEFAULT 100,               -- API health component
  storage_health_score INTEGER NOT NULL DEFAULT 100,           -- Storage health component
  database_health_score INTEGER NOT NULL DEFAULT 100,          -- Database health component
  avg_response_time_ms DECIMAL(10, 2) DEFAULT 0,
  error_rate_percent DECIMAL(5, 2) DEFAULT 0,
  active_users_count INTEGER DEFAULT 0,
  requests_per_minute INTEGER DEFAULT 0,
  memory_usage_percent DECIMAL(5, 2) DEFAULT 0,
  cpu_usage_percent DECIMAL(5, 2) DEFAULT 0,
  disk_usage_percent DECIMAL(5, 2) DEFAULT 0,
  database_connections INTEGER DEFAULT 0,
  uptime_seconds BIGINT DEFAULT 0,
  alerts JSONB DEFAULT '[]'::jsonb,                            -- Active alerts
  metadata JSONB DEFAULT '{}'::jsonb,                          -- Additional metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_api_metrics_date ON api_metrics(date);
CREATE INDEX idx_api_metrics_endpoint ON api_metrics(endpoint);
CREATE INDEX idx_api_metrics_date_endpoint ON api_metrics(date, endpoint, method);
CREATE INDEX idx_api_error_logs_timestamp ON api_error_logs(timestamp);
CREATE INDEX idx_api_error_logs_endpoint ON api_error_logs(endpoint);
CREATE INDEX idx_api_error_logs_status_code ON api_error_logs(status_code);
CREATE INDEX idx_storage_metrics_date ON storage_metrics(date);
CREATE INDEX idx_video_hosting_costs_date ON video_hosting_costs(date);
CREATE INDEX idx_platform_health_snapshots_timestamp ON platform_health_snapshots(timestamp);

-- Comments for documentation
COMMENT ON TABLE api_metrics IS 'Aggregated API performance metrics per endpoint per hour';
COMMENT ON TABLE api_error_logs IS 'Individual API error occurrences for debugging and analysis';
COMMENT ON TABLE storage_metrics IS 'Daily storage usage tracking across file types';
COMMENT ON TABLE video_hosting_costs IS 'Daily estimated video hosting costs breakdown';
COMMENT ON TABLE platform_health_snapshots IS 'Periodic platform health status snapshots';
