/**
 * Platform Health Monitoring Service
 * Per Specification Section 4.3.G (Analytics & Reports - Platform health)
 *
 * Tracks:
 * - API response times
 * - Error rates
 * - Storage usage
 * - Video hosting costs
 */

import { db } from './db';
import {
  apiMetrics,
  apiErrorLogs,
  storageMetrics,
  videoHostingCosts,
  platformHealthSnapshots,
  offerVideos,
  companyVerificationDocuments,
  users,
} from '../shared/schema';
import { eq, sql, and, gte, lte, desc, count } from 'drizzle-orm';
import os from 'os';

// In-memory buffer for API metrics (flushed periodically to database)
interface MetricBuffer {
  endpoint: string;
  method: string;
  responseTimes: number[];
  successCount: number;
  errorCount: number;
  error4xxCount: number;
  error5xxCount: number;
}

const metricsBuffer: Map<string, MetricBuffer> = new Map();
let lastFlushTime = Date.now();
const FLUSH_INTERVAL_MS = 60000; // Flush every minute
const serverStartTime = Date.now();

/**
 * Record an API request metric
 */
export function recordApiMetric(
  endpoint: string,
  method: string,
  responseTimeMs: number,
  statusCode: number
): void {
  const key = `${method}:${endpoint}`;

  if (!metricsBuffer.has(key)) {
    metricsBuffer.set(key, {
      endpoint,
      method,
      responseTimes: [],
      successCount: 0,
      errorCount: 0,
      error4xxCount: 0,
      error5xxCount: 0,
    });
  }

  const buffer = metricsBuffer.get(key)!;
  buffer.responseTimes.push(responseTimeMs);

  if (statusCode >= 200 && statusCode < 400) {
    buffer.successCount++;
  } else {
    buffer.errorCount++;
    if (statusCode >= 400 && statusCode < 500) {
      buffer.error4xxCount++;
    } else if (statusCode >= 500) {
      buffer.error5xxCount++;
    }
  }

  // Auto-flush if enough time has passed
  if (Date.now() - lastFlushTime >= FLUSH_INTERVAL_MS) {
    flushMetrics().catch(console.error);
  }
}

/**
 * Record an API error for detailed logging
 */
export async function recordApiError(
  endpoint: string,
  method: string,
  statusCode: number,
  errorMessage: string,
  errorStack?: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string,
  requestBody?: object
): Promise<void> {
  try {
    // Sanitize request body (remove sensitive fields)
    const sanitizedBody = requestBody ? sanitizeRequestBody(requestBody) : null;

    await db.insert(apiErrorLogs).values({
      endpoint,
      method,
      statusCode,
      errorMessage,
      errorStack: errorStack || null,
      requestId: generateRequestId(),
      userId: userId || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      requestBody: sanitizedBody,
    });
  } catch (error) {
    console.error('[Platform Health] Failed to record error log:', error);
  }
}

/**
 * Flush buffered metrics to database
 */
export async function flushMetrics(): Promise<void> {
  if (metricsBuffer.size === 0) return;

  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hour = now.getHours();

  try {
    for (const [, buffer] of Array.from(metricsBuffer)) {
      if (buffer.responseTimes.length === 0) continue;

      const stats = calculateStats(buffer.responseTimes);
      const totalRequests = buffer.successCount + buffer.errorCount;

      // Upsert metrics (insert or update if exists)
      await db.execute(sql`
        INSERT INTO api_metrics (
          endpoint, method, date, hour,
          total_requests, successful_requests, error_requests,
          avg_response_time_ms, min_response_time_ms, max_response_time_ms,
          p50_response_time_ms, p95_response_time_ms, p99_response_time_ms,
          error_4xx_count, error_5xx_count, updated_at
        ) VALUES (
          ${buffer.endpoint}, ${buffer.method}, ${date}::DATE, ${hour}::INTEGER,
          ${totalRequests}::INTEGER, ${buffer.successCount}::INTEGER, ${buffer.errorCount}::INTEGER,
          ${stats.avg}::DECIMAL, ${stats.min}::INTEGER, ${stats.max}::INTEGER,
          ${stats.p50}::INTEGER, ${stats.p95}::INTEGER, ${stats.p99}::INTEGER,
          ${buffer.error4xxCount}::INTEGER, ${buffer.error5xxCount}::INTEGER, NOW()
        )
        ON CONFLICT (endpoint, method, date, hour)
        DO UPDATE SET
          total_requests = api_metrics.total_requests + ${totalRequests}::INTEGER,
          successful_requests = api_metrics.successful_requests + ${buffer.successCount}::INTEGER,
          error_requests = api_metrics.error_requests + ${buffer.errorCount}::INTEGER,
          avg_response_time_ms = (
            (api_metrics.avg_response_time_ms * api_metrics.total_requests::DECIMAL + ${stats.avg}::DECIMAL * ${totalRequests}::DECIMAL) /
            NULLIF(api_metrics.total_requests + ${totalRequests}::INTEGER, 0)
          ),
          min_response_time_ms = LEAST(api_metrics.min_response_time_ms, ${stats.min}::INTEGER),
          max_response_time_ms = GREATEST(api_metrics.max_response_time_ms, ${stats.max}::INTEGER),
          p50_response_time_ms = ${stats.p50}::INTEGER,
          p95_response_time_ms = ${stats.p95}::INTEGER,
          p99_response_time_ms = ${stats.p99}::INTEGER,
          error_4xx_count = api_metrics.error_4xx_count + ${buffer.error4xxCount}::INTEGER,
          error_5xx_count = api_metrics.error_5xx_count + ${buffer.error5xxCount}::INTEGER,
          updated_at = NOW()
      `);
    }

    // Clear buffer after successful flush
    metricsBuffer.clear();
    lastFlushTime = Date.now();
    console.log('[Platform Health] Metrics flushed successfully');
  } catch (error) {
    console.error('[Platform Health] Failed to flush metrics:', error);
  }
}

/**
 * Calculate storage usage from database
 */
export async function calculateStorageUsage(): Promise<{
  totalFiles: number;
  totalStorageBytes: number;
  videoFiles: number;
  videoStorageBytes: number;
  imageFiles: number;
  imageStorageBytes: number;
  documentFiles: number;
  documentStorageBytes: number;
}> {
  try {
    // Get video count and estimated sizes
    const [videos] = await db
      .select({ count: count() })
      .from(offerVideos);

    // Get document count
    const [documents] = await db
      .select({ count: count() })
      .from(companyVerificationDocuments);

    // Get user profile images (estimate based on user count)
    const [userCount] = await db
      .select({ count: count() })
      .from(users);

    // Estimate sizes (in real implementation, this would query actual storage)
    const videoCount = videos?.count || 0;
    const documentCount = documents?.count || 0;
    const imageCount = userCount?.count || 0;

    // Estimated average sizes
    const AVG_VIDEO_SIZE_MB = 50; // 50MB average video size
    const AVG_DOCUMENT_SIZE_KB = 500; // 500KB average document
    const AVG_IMAGE_SIZE_KB = 200; // 200KB average profile image

    const videoStorageBytes = videoCount * AVG_VIDEO_SIZE_MB * 1024 * 1024;
    const documentStorageBytes = documentCount * AVG_DOCUMENT_SIZE_KB * 1024;
    const imageStorageBytes = imageCount * AVG_IMAGE_SIZE_KB * 1024;

    return {
      totalFiles: videoCount + documentCount + imageCount,
      totalStorageBytes: videoStorageBytes + documentStorageBytes + imageStorageBytes,
      videoFiles: videoCount,
      videoStorageBytes,
      imageFiles: imageCount,
      imageStorageBytes,
      documentFiles: documentCount,
      documentStorageBytes,
    };
  } catch (error) {
    console.error('[Platform Health] Failed to calculate storage:', error);
    return {
      totalFiles: 0,
      totalStorageBytes: 0,
      videoFiles: 0,
      videoStorageBytes: 0,
      imageFiles: 0,
      imageStorageBytes: 0,
      documentFiles: 0,
      documentStorageBytes: 0,
    };
  }
}

/**
 * Calculate video hosting costs
 * Based on typical cloud video hosting pricing:
 * - Storage: $0.023 per GB per month (AWS S3 standard)
 * - Bandwidth: $0.09 per GB (AWS CloudFront)
 * - Transcoding: $0.015 per minute
 */
export async function calculateVideoHostingCosts(): Promise<{
  totalVideos: number;
  totalVideoStorageGb: number;
  totalBandwidthGb: number;
  storageCostUsd: number;
  bandwidthCostUsd: number;
  transcodingCostUsd: number;
  totalCostUsd: number;
  costPerVideoUsd: number;
  viewsCount: number;
}> {
  // Pricing constants (configurable in production)
  const STORAGE_COST_PER_GB = 0.023;
  const BANDWIDTH_COST_PER_GB = 0.09;
  const TRANSCODING_COST_PER_MIN = 0.015;
  const AVG_VIDEO_LENGTH_MIN = 3; // Average video length in minutes
  const AVG_VIDEO_SIZE_GB = 0.05; // 50MB per video
  const AVG_BANDWIDTH_PER_VIEW_MB = 100; // 100MB per view (streaming)

  try {
    // Get total video count
    const [videos] = await db
      .select({ count: count() })
      .from(offerVideos);

    const totalVideos = videos?.count || 0;

    // Get total views from offers (sum of view counts)
    const viewsResult = await db.execute(sql`
      SELECT COALESCE(SUM(view_count), 0) as total_views FROM offers
    `);
    const viewsCount = parseInt((viewsResult.rows[0] as any)?.total_views || '0', 10);

    // Calculate storage
    const totalVideoStorageGb = totalVideos * AVG_VIDEO_SIZE_GB;
    const storageCostUsd = totalVideoStorageGb * STORAGE_COST_PER_GB;

    // Calculate bandwidth (based on views)
    const totalBandwidthGb = (viewsCount * AVG_BANDWIDTH_PER_VIEW_MB) / 1024;
    const bandwidthCostUsd = totalBandwidthGb * BANDWIDTH_COST_PER_GB;

    // Calculate transcoding (one-time per video upload)
    const transcodingCostUsd = totalVideos * AVG_VIDEO_LENGTH_MIN * TRANSCODING_COST_PER_MIN;

    // Total cost
    const totalCostUsd = storageCostUsd + bandwidthCostUsd + transcodingCostUsd;
    const costPerVideoUsd = totalVideos > 0 ? totalCostUsd / totalVideos : 0;

    return {
      totalVideos,
      totalVideoStorageGb,
      totalBandwidthGb,
      storageCostUsd,
      bandwidthCostUsd,
      transcodingCostUsd,
      totalCostUsd,
      costPerVideoUsd,
      viewsCount,
    };
  } catch (error) {
    console.error('[Platform Health] Failed to calculate video costs:', error);
    return {
      totalVideos: 0,
      totalVideoStorageGb: 0,
      totalBandwidthGb: 0,
      storageCostUsd: 0,
      bandwidthCostUsd: 0,
      transcodingCostUsd: 0,
      totalCostUsd: 0,
      costPerVideoUsd: 0,
      viewsCount: 0,
    };
  }
}

/**
 * Record daily storage metrics
 */
export async function recordDailyStorageMetrics(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const storageData = await calculateStorageUsage();

    await db.execute(sql`
      INSERT INTO storage_metrics (
        date, total_files, total_storage_bytes,
        video_files, video_storage_bytes,
        image_files, image_storage_bytes,
        document_files, document_storage_bytes,
        updated_at
      ) VALUES (
        ${today}, ${storageData.totalFiles}, ${storageData.totalStorageBytes},
        ${storageData.videoFiles}, ${storageData.videoStorageBytes},
        ${storageData.imageFiles}, ${storageData.imageStorageBytes},
        ${storageData.documentFiles}, ${storageData.documentStorageBytes},
        NOW()
      )
      ON CONFLICT (date) DO UPDATE SET
        total_files = ${storageData.totalFiles},
        total_storage_bytes = ${storageData.totalStorageBytes},
        video_files = ${storageData.videoFiles},
        video_storage_bytes = ${storageData.videoStorageBytes},
        image_files = ${storageData.imageFiles},
        image_storage_bytes = ${storageData.imageStorageBytes},
        document_files = ${storageData.documentFiles},
        document_storage_bytes = ${storageData.documentStorageBytes},
        updated_at = NOW()
    `);

    console.log('[Platform Health] Daily storage metrics recorded');
  } catch (error) {
    console.error('[Platform Health] Failed to record storage metrics:', error);
  }
}

/**
 * Record daily video hosting costs
 */
export async function recordDailyVideoCosts(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const costData = await calculateVideoHostingCosts();

    await db.execute(sql`
      INSERT INTO video_hosting_costs (
        date, total_videos, total_video_storage_gb, total_bandwidth_gb,
        storage_cost_usd, bandwidth_cost_usd, transcoding_cost_usd,
        total_cost_usd, cost_per_video_usd, views_count,
        updated_at
      ) VALUES (
        ${today}, ${costData.totalVideos}, ${costData.totalVideoStorageGb}, ${costData.totalBandwidthGb},
        ${costData.storageCostUsd}, ${costData.bandwidthCostUsd}, ${costData.transcodingCostUsd},
        ${costData.totalCostUsd}, ${costData.costPerVideoUsd}, ${costData.viewsCount},
        NOW()
      )
      ON CONFLICT (date) DO UPDATE SET
        total_videos = ${costData.totalVideos},
        total_video_storage_gb = ${costData.totalVideoStorageGb},
        total_bandwidth_gb = ${costData.totalBandwidthGb},
        storage_cost_usd = ${costData.storageCostUsd},
        bandwidth_cost_usd = ${costData.bandwidthCostUsd},
        transcoding_cost_usd = ${costData.transcodingCostUsd},
        total_cost_usd = ${costData.totalCostUsd},
        cost_per_video_usd = ${costData.costPerVideoUsd},
        views_count = ${costData.viewsCount},
        updated_at = NOW()
    `);

    console.log('[Platform Health] Daily video costs recorded');
  } catch (error) {
    console.error('[Platform Health] Failed to record video costs:', error);
  }
}

/**
 * Create a platform health snapshot
 */
export async function createHealthSnapshot(): Promise<void> {
  try {
    // Get recent API metrics
    const recentMetrics = await getRecentApiMetrics(1); // Last 1 hour

    // Calculate health scores
    const avgResponseTime = recentMetrics.avgResponseTime || 0;
    const errorRate = recentMetrics.errorRate || 0;

    // Health score calculation (0-100)
    // - Response time: <100ms = 100, 2500ms = 50, >5000ms = 0
    // - Error rate: 0% = 100, >10% = 0
    // Using /50 divisor for more gradual degradation (was /10 which was too aggressive)
    const apiHealthScore = Math.max(0, Math.min(100,
      100 - (avgResponseTime / 50) - (errorRate * 10)
    ));

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    const cpuUsage = os.loadavg()[0] * 100 / os.cpus().length; // 1-minute load average

    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    // Calculate overall health score
    const overallHealthScore = Math.round(
      (apiHealthScore * 0.6) + // 60% weight on API health
      (Math.max(0, 100 - memoryUsagePercent) * 0.2) + // 20% on memory
      (Math.max(0, 100 - cpuUsage) * 0.2) // 20% on CPU
    );

    // Generate alerts
    const alerts: Array<{ type: string; message: string; severity: string }> = [];

    if (avgResponseTime > 500) {
      alerts.push({
        type: 'slow_response',
        message: `Average API response time is ${Math.round(avgResponseTime)}ms`,
        severity: avgResponseTime > 1000 ? 'critical' : 'warning',
      });
    }

    if (errorRate > 1) {
      alerts.push({
        type: 'high_error_rate',
        message: `Error rate is ${errorRate.toFixed(2)}%`,
        severity: errorRate > 5 ? 'critical' : 'warning',
      });
    }

    if (memoryUsagePercent > 80) {
      alerts.push({
        type: 'high_memory',
        message: `Memory usage is ${memoryUsagePercent.toFixed(1)}%`,
        severity: memoryUsagePercent > 90 ? 'critical' : 'warning',
      });
    }

    await db.insert(platformHealthSnapshots).values({
      overallHealthScore,
      apiHealthScore: Math.round(apiHealthScore),
      storageHealthScore: 100, // Placeholder
      databaseHealthScore: 100, // Placeholder (would need DB-specific checks)
      avgResponseTimeMs: avgResponseTime.toString(),
      errorRatePercent: errorRate.toString(),
      activeUsersCount: 0, // Would need session tracking
      requestsPerMinute: recentMetrics.requestsPerMinute || 0,
      memoryUsagePercent: memoryUsagePercent.toString(),
      cpuUsagePercent: cpuUsage.toString(),
      diskUsagePercent: '0', // Placeholder
      databaseConnections: 0, // Placeholder
      uptimeSeconds: uptimeSeconds.toString(),
      alerts: alerts,
      metadata: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
      },
    });

    console.log('[Platform Health] Health snapshot created, score:', overallHealthScore);
  } catch (error) {
    console.error('[Platform Health] Failed to create health snapshot:', error);
  }
}

/**
 * Get recent API metrics summary
 */
export async function getRecentApiMetrics(hours: number = 24): Promise<{
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  avgResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  topEndpoints: Array<{ endpoint: string; method: string; count: number; avgTime: number }>;
  errorsByEndpoint: Array<{ endpoint: string; method: string; errorCount: number }>;
}> {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    const metrics = await db
      .select()
      .from(apiMetrics)
      .where(gte(apiMetrics.date, cutoffTime))
      .orderBy(desc(apiMetrics.totalRequests));

    const totals = metrics.reduce((acc, m) => ({
      totalRequests: acc.totalRequests + (m.totalRequests || 0),
      successfulRequests: acc.successfulRequests + (m.successfulRequests || 0),
      errorRequests: acc.errorRequests + (m.errorRequests || 0),
      responseTimeSum: acc.responseTimeSum + (parseFloat(m.avgResponseTimeMs?.toString() || '0') * (m.totalRequests || 0)),
    }), { totalRequests: 0, successfulRequests: 0, errorRequests: 0, responseTimeSum: 0 });

    const avgResponseTime = totals.totalRequests > 0
      ? totals.responseTimeSum / totals.totalRequests
      : 0;

    const errorRate = totals.totalRequests > 0
      ? (totals.errorRequests / totals.totalRequests) * 100
      : 0;

    const requestsPerMinute = Math.round(totals.totalRequests / (hours * 60));

    // Group by endpoint for top endpoints
    const endpointMap = new Map<string, { count: number; totalTime: number }>();
    for (const m of metrics) {
      const key = `${m.method}:${m.endpoint}`;
      const existing = endpointMap.get(key) || { count: 0, totalTime: 0 };
      endpointMap.set(key, {
        count: existing.count + (m.totalRequests || 0),
        totalTime: existing.totalTime + (parseFloat(m.avgResponseTimeMs?.toString() || '0') * (m.totalRequests || 0)),
      });
    }

    const topEndpoints = Array.from(endpointMap.entries())
      .map(([key, data]) => {
        const [method, ...endpointParts] = key.split(':');
        return {
          endpoint: endpointParts.join(':'),
          method,
          count: data.count,
          avgTime: data.count > 0 ? data.totalTime / data.count : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Group errors by endpoint
    const errorMap = new Map<string, number>();
    for (const m of metrics) {
      if (m.errorRequests && m.errorRequests > 0) {
        const key = `${m.method}:${m.endpoint}`;
        errorMap.set(key, (errorMap.get(key) || 0) + m.errorRequests);
      }
    }

    const errorsByEndpoint = Array.from(errorMap.entries())
      .map(([key, errorCount]) => {
        const [method, ...endpointParts] = key.split(':');
        return {
          endpoint: endpointParts.join(':'),
          method,
          errorCount,
        };
      })
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);

    return {
      totalRequests: totals.totalRequests,
      successfulRequests: totals.successfulRequests,
      errorRequests: totals.errorRequests,
      avgResponseTime,
      errorRate,
      requestsPerMinute,
      topEndpoints,
      errorsByEndpoint,
    };
  } catch (error) {
    console.error('[Platform Health] Failed to get recent metrics:', error);
    return {
      totalRequests: 0,
      successfulRequests: 0,
      errorRequests: 0,
      avgResponseTime: 0,
      errorRate: 0,
      requestsPerMinute: 0,
      topEndpoints: [],
      errorsByEndpoint: [],
    };
  }
}

/**
 * Get API metrics time series for charts
 */
export async function getApiMetricsTimeSeries(
  days: number = 7
): Promise<Array<{
  date: string;
  totalRequests: number;
  errorRate: number;
  avgResponseTime: number;
}>> {
  const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const result = await db.execute(sql`
      SELECT
        DATE(date) as date,
        SUM(total_requests) as total_requests,
        SUM(error_requests) as error_requests,
        AVG(avg_response_time_ms) as avg_response_time
      FROM api_metrics
      WHERE date >= ${cutoffTime}
      GROUP BY DATE(date)
      ORDER BY DATE(date)
    `);

    return (result.rows as any[]).map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      totalRequests: parseInt(row.total_requests || '0', 10),
      errorRate: row.total_requests > 0
        ? (parseInt(row.error_requests || '0', 10) / parseInt(row.total_requests, 10)) * 100
        : 0,
      avgResponseTime: parseFloat(row.avg_response_time || '0'),
    }));
  } catch (error) {
    console.error('[Platform Health] Failed to get time series:', error);
    return [];
  }
}

/**
 * Get recent error logs
 */
export async function getRecentErrorLogs(
  limit: number = 50
): Promise<Array<{
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string | null;
  timestamp: Date | null;
  userId: string | null;
}>> {
  try {
    const errors = await db
      .select({
        id: apiErrorLogs.id,
        endpoint: apiErrorLogs.endpoint,
        method: apiErrorLogs.method,
        statusCode: apiErrorLogs.statusCode,
        errorMessage: apiErrorLogs.errorMessage,
        timestamp: apiErrorLogs.timestamp,
        userId: apiErrorLogs.userId,
      })
      .from(apiErrorLogs)
      .orderBy(desc(apiErrorLogs.timestamp))
      .limit(limit);

    return errors;
  } catch (error) {
    console.error('[Platform Health] Failed to get error logs:', error);
    return [];
  }
}

/**
 * Get storage metrics time series
 */
export async function getStorageMetricsTimeSeries(
  days: number = 30
): Promise<Array<{
  date: string;
  totalStorageGb: number;
  videoStorageGb: number;
  imageStorageGb: number;
  documentStorageGb: number;
}>> {
  const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const metrics = await db
      .select()
      .from(storageMetrics)
      .where(gte(storageMetrics.date, cutoffTime))
      .orderBy(storageMetrics.date);

    return metrics
      .filter(m => m.date && !isNaN(new Date(m.date).getTime()))
      .map(m => ({
        date: new Date(m.date).toISOString().split('T')[0],
        totalStorageGb: parseFloat(m.totalStorageBytes?.toString() || '0') / (1024 * 1024 * 1024),
        videoStorageGb: parseFloat(m.videoStorageBytes?.toString() || '0') / (1024 * 1024 * 1024),
        imageStorageGb: parseFloat(m.imageStorageBytes?.toString() || '0') / (1024 * 1024 * 1024),
        documentStorageGb: parseFloat(m.documentStorageBytes?.toString() || '0') / (1024 * 1024 * 1024),
      }));
  } catch (error) {
    console.error('[Platform Health] Failed to get storage time series:', error);
    return [];
  }
}

/**
 * Get video hosting costs time series
 */
export async function getVideoCostsTimeSeries(
  days: number = 30
): Promise<Array<{
  date: string;
  totalCostUsd: number;
  storageCostUsd: number;
  bandwidthCostUsd: number;
  transcodingCostUsd: number;
}>> {
  const cutoffTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const costs = await db
      .select()
      .from(videoHostingCosts)
      .where(gte(videoHostingCosts.date, cutoffTime))
      .orderBy(videoHostingCosts.date);

    return costs
      .filter(c => c.date && !isNaN(new Date(c.date).getTime()))
      .map(c => ({
        date: new Date(c.date).toISOString().split('T')[0],
        totalCostUsd: parseFloat(c.totalCostUsd?.toString() || '0'),
        storageCostUsd: parseFloat(c.storageCostUsd?.toString() || '0'),
        bandwidthCostUsd: parseFloat(c.bandwidthCostUsd?.toString() || '0'),
        transcodingCostUsd: parseFloat(c.transcodingCostUsd?.toString() || '0'),
      }));
  } catch (error) {
    console.error('[Platform Health] Failed to get video costs time series:', error);
    return [];
  }
}

/**
 * Get latest health snapshot
 */
export async function getLatestHealthSnapshot(): Promise<{
  overallHealthScore: number;
  apiHealthScore: number;
  storageHealthScore: number;
  databaseHealthScore: number;
  avgResponseTimeMs: number;
  errorRatePercent: number;
  memoryUsagePercent: number;
  cpuUsagePercent: number;
  uptimeSeconds: number;
  alerts: Array<{ type: string; message: string; severity: string }>;
  timestamp: Date | null;
} | null> {
  try {
    const [snapshot] = await db
      .select()
      .from(platformHealthSnapshots)
      .orderBy(desc(platformHealthSnapshots.timestamp))
      .limit(1);

    if (!snapshot) return null;

    return {
      overallHealthScore: snapshot.overallHealthScore,
      apiHealthScore: snapshot.apiHealthScore,
      storageHealthScore: snapshot.storageHealthScore,
      databaseHealthScore: snapshot.databaseHealthScore,
      avgResponseTimeMs: parseFloat(snapshot.avgResponseTimeMs?.toString() || '0'),
      errorRatePercent: parseFloat(snapshot.errorRatePercent?.toString() || '0'),
      memoryUsagePercent: parseFloat(snapshot.memoryUsagePercent?.toString() || '0'),
      cpuUsagePercent: parseFloat(snapshot.cpuUsagePercent?.toString() || '0'),
      uptimeSeconds: parseInt(snapshot.uptimeSeconds?.toString() || '0', 10),
      alerts: (snapshot.alerts as any) || [],
      timestamp: snapshot.timestamp,
    };
  } catch (error) {
    console.error('[Platform Health] Failed to get latest snapshot:', error);
    return null;
  }
}

/**
 * Get comprehensive platform health report
 */
export async function getPlatformHealthReport(): Promise<{
  snapshot: Awaited<ReturnType<typeof getLatestHealthSnapshot>>;
  apiMetrics: Awaited<ReturnType<typeof getRecentApiMetrics>>;
  storage: Awaited<ReturnType<typeof calculateStorageUsage>>;
  videoCosts: Awaited<ReturnType<typeof calculateVideoHostingCosts>>;
  apiTimeSeries: Awaited<ReturnType<typeof getApiMetricsTimeSeries>>;
  storageTimeSeries: Awaited<ReturnType<typeof getStorageMetricsTimeSeries>>;
  costTimeSeries: Awaited<ReturnType<typeof getVideoCostsTimeSeries>>;
  recentErrors: Awaited<ReturnType<typeof getRecentErrorLogs>>;
}> {
  const [
    snapshot,
    apiMetrics,
    storage,
    videoCosts,
    apiTimeSeries,
    storageTimeSeries,
    costTimeSeries,
    recentErrors,
  ] = await Promise.all([
    getLatestHealthSnapshot(),
    getRecentApiMetrics(24),
    calculateStorageUsage(),
    calculateVideoHostingCosts(),
    getApiMetricsTimeSeries(7),
    getStorageMetricsTimeSeries(30),
    getVideoCostsTimeSeries(30),
    getRecentErrorLogs(20),
  ]);

  return {
    snapshot,
    apiMetrics,
    storage,
    videoCosts,
    apiTimeSeries,
    storageTimeSeries,
    costTimeSeries,
    recentErrors,
  };
}

// ============ Helper Functions ============

function calculateStats(values: number[]): {
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
} {
  if (values.length === 0) {
    return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    avg: sum / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function sanitizeRequestBody(body: object): object {
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'cookie'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeRequestBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============ Scheduled Tasks ============

/**
 * Initialize scheduled health monitoring tasks
 */
export function initializeHealthMonitoring(): void {
  console.log('[Platform Health] Initializing health monitoring...');

  // Flush metrics every minute
  setInterval(() => {
    flushMetrics().catch(console.error);
  }, FLUSH_INTERVAL_MS);

  // Create health snapshot every 5 minutes
  setInterval(() => {
    createHealthSnapshot().catch(console.error);
  }, 5 * 60 * 1000);

  // Record daily metrics at midnight
  const scheduleDaily = () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      recordDailyStorageMetrics().catch(console.error);
      recordDailyVideoCosts().catch(console.error);
      scheduleDaily(); // Schedule next day
    }, msUntilMidnight);
  };

  scheduleDaily();

  // Initial snapshot
  createHealthSnapshot().catch(console.error);

  console.log('[Platform Health] Health monitoring initialized');
}
