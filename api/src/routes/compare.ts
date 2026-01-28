import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  runComparison,
  getComparisonResult,
  getAllComparisonResults,
  getComparisonStats,
} from '../services/comparison.js';

const router = Router();

// Request validation schema
const ComparisonRequestSchema = z.object({
  imageBase64: z.string().optional(),
  imageUrl: z.string().url().optional(),
  productName: z.string().optional(),
  productDescription: z.string().optional(),
  originCountry: z.string().length(2).optional(),
  shipToCountry: z.string().length(2).default('FR'),
  productValue: z.number().positive().optional(),
  currency: z.string().length(3).default('EUR'),
  providers: z
    .array(z.enum(['anthropic', 'openai', 'zonos']))
    .default(['anthropic', 'openai', 'zonos']),
  calculateDuty: z.boolean().default(false),
}).refine(
  (data) => data.imageBase64 || data.imageUrl || data.productName || data.productDescription,
  { message: 'At least one of imageBase64, imageUrl, productName, or productDescription is required' }
);

/**
 * POST /api/compare
 * Run A/B comparison between AI providers for HS code classification
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedRequest = ComparisonRequestSchema.parse(req.body);
    const result = await runComparison(validatedRequest);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    console.error('Comparison error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/compare/stats/summary
 * Get aggregated statistics for all comparisons
 */
router.get('/stats/summary', (_req: Request, res: Response) => {
  const stats = getComparisonStats();
  res.json(stats);
});

/**
 * GET /api/compare
 * Get all comparison results
 */
router.get('/', (_req: Request, res: Response) => {
  const results = getAllComparisonResults();
  res.json({ results, count: results.length });
});

/**
 * GET /api/compare/:id
 * Get a specific comparison result by ID
 */
router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  const result = getComparisonResult(req.params.id);
  if (!result) {
    res.status(404).json({ error: 'Comparison not found' });
    return;
  }
  res.json(result);
});

export default router;
