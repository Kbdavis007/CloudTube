import express from 'express';
import {
  VERSION,
  TAG,
  COMMIT,
  COMMIT_DATE,
  BRANCH,
  DIRTY,
  VERSION_LABEL,
} from './src/generated/version';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'CloudTube Studio Backend',
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      commitDate: COMMIT_DATE,
      branch: BRANCH,
      dirty: DIRTY,
      versionLabel: VERSION_LABEL,
    });
  });

  // Cloudflare Admin API v4 Proxy endpoint
  // Bypasses browser CORS restrictions by executing requests from the Node.js server
  app.post('/api/cloudflare/proxy', async (req, res) => {
    const { endpoint, method = 'GET', headers = {}, body } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        status: 400,
        errors: [{ message: 'Missing required "endpoint" parameter' }],
      });
    }

    const cfUrl = `https://api.cloudflare.com/client/v4${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    // Prepare headers (forward authorization token and content-type)
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CloudTube-Studio/1.0',
      ...headers,
    };

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: requestHeaders,
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const startTime = Date.now();
    try {
      console.log(`[CF_PROXY] Outgoing ${fetchOptions.method} -> ${cfUrl}`);
      const cfResponse = await fetch(cfUrl, fetchOptions);
      const durationMs = Date.now() - startTime;
      
      const responseText = await cfResponse.text();
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawText: responseText };
      }

      console.log(`[CF_PROXY] Cloudflare responded ${cfResponse.status} in ${durationMs}ms`);

      return res.status(cfResponse.status).json({
        status: cfResponse.status,
        ok: cfResponse.ok,
        durationMs,
        data: responseData,
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error(`[CF_PROXY] Network error connecting to Cloudflare:`, err);
      return res.status(502).json({
        status: 502,
        ok: false,
        durationMs,
        errors: [
          {
            message: `Failed to reach Cloudflare API server: ${err.message}`,
            code: 502,
          },
        ],
      });
    }
  });

  if (!isProd) {
    // In development mode, mount Vite as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Dev] Vite middleware mounted');
  } else {
    // In production, serve static files from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[Prod] Serving static assets from ${distPath}`);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CloudTube Studio full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
