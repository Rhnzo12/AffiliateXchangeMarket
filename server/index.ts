import 'dotenv/config'
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runAutoMigrations } from "./auto-migrate";
import { initializeModerationKeywords } from "./moderation/moderationService";
import { recordApiMetric, recordApiError, initializeHealthMonitoring } from "./platformHealthService";

const app = express();
app.disable('x-powered-by'); // Security: Hide Express server information
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Metrics Collection Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Record API metrics for platform health monitoring
      const normalizedPath = normalizeEndpoint(path);
      recordApiMetric(normalizedPath, req.method, duration, res.statusCode);

      // Log errors with details
      if (res.statusCode >= 400) {
        const userId = (req as any).user?.id;
        recordApiError(
          normalizedPath,
          req.method,
          res.statusCode,
          capturedJsonResponse?.message || 'Unknown error',
          undefined,
          userId,
          req.ip,
          req.get('user-agent')
        ).catch(console.error);
      }

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Normalize endpoint paths (replace dynamic IDs with :id)
function normalizeEndpoint(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUIDs
    .replace(/\/\d+/g, '/:id'); // Numeric IDs
}

(async () => {
  // Run auto-migrations to ensure database schema is up to date
  try {
    await runAutoMigrations();
  } catch (error) {
    log('Warning: Auto-migration failed. Some features may not work correctly.');
    console.error(error);
  }

  // Initialize content moderation with default keywords
  try {
    await initializeModerationKeywords();
  } catch (error) {
    log('Warning: Moderation initialization failed. Content moderation may not work correctly.');
    console.error(error);
  }

  // Initialize platform health monitoring
  try {
    initializeHealthMonitoring();
  } catch (error) {
    log('Warning: Health monitoring initialization failed. Health metrics may not be collected.');
    console.error(error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  server.listen(port, () => {
    log(`Server running on port ${port}`);
    log(`Environment: ${process.env.NODE_ENV}`);
  });
})();