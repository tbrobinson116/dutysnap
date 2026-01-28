import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compareRouter from './routes/compare.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for base64 images

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info
app.get('/api', (_req, res) => {
  res.json({
    name: 'DutySnap API',
    version: '0.1.0',
    description: 'A/B testing API for HS code classification comparison',
    endpoints: {
      'POST /api/compare': 'Run classification comparison between Anthropic, OpenAI, and Zonos',
      'GET /api/compare': 'List all comparison results',
      'GET /api/compare/:id': 'Get specific comparison result',
      'GET /api/compare/stats/summary': 'Get aggregated comparison statistics',
    },
    documentation: {
      compareRequest: {
        imageBase64: 'Base64 encoded image (data:image/jpeg;base64,...)',
        imageUrl: 'URL to product image',
        productName: 'Product name/title',
        productDescription: 'Detailed product description',
        originCountry: 'ISO 2-letter country code (e.g., US, CN)',
        shipToCountry: 'ISO 2-letter destination country (default: FR)',
        productValue: 'Product value for duty calculation',
        currency: 'Currency code (default: EUR)',
        providers: 'Array of providers to test: ["anthropic", "openai", "zonos"]',
        calculateDuty: 'Whether to calculate duties for each classification',
      },
    },
  });
});

// Routes
app.use('/api/compare', compareRouter);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    DutySnap API v0.1.0                    ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at http://localhost:${PORT}                  ║
║                                                           ║
║  Endpoints:                                               ║
║    GET  /api              - API documentation             ║
║    POST /api/compare      - Run A/B comparison            ║
║    GET  /api/compare      - List all results              ║
║    GET  /api/compare/:id  - Get specific result           ║
║    GET  /api/compare/stats/summary - Get statistics       ║
║                                                           ║
║  Environment:                                             ║
║    ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ missing'}                      ║
║    OPENAI_API_KEY:    ${process.env.OPENAI_API_KEY ? '✓ configured' : '✗ missing'}                      ║
║    ZONOS_API_KEY:     ${process.env.ZONOS_API_KEY ? '✓ configured' : '✗ missing'}                      ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
