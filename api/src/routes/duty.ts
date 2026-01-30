import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { calculateDutyWithZonos } from '../services/classifiers/index.js';

const router = Router();

const DutyRequestSchema = z.object({
  hsCode: z.string().min(6, 'HS code must be at least 6 digits'),
  productValue: z.number().positive('Product value must be positive'),
  currency: z.string().length(3).default('EUR'),
  originCountry: z.string().length(2).default('US'),
  shipToCountry: z.string().length(2).default('FR'),
});

/**
 * POST /api/duty
 * Calculate import duties and taxes for a given HS code and product value
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const validated = DutyRequestSchema.parse(req.body);

    const result = await calculateDutyWithZonos(
      validated.hsCode,
      validated.productValue,
      validated.currency,
      validated.originCountry,
      validated.shipToCountry
    );

    if (result.error) {
      res.status(502).json({
        error: 'Duty calculation failed',
        message: result.error,
        result,
      });
      return;
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    console.error('Duty calculation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
