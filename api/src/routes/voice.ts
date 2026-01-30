import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

const ParseVoiceSchema = z.object({
  transcript: z.string().min(1, 'Transcript is required'),
});

const SYSTEM_PROMPT = `You are a voice command parser for a customs duty calculator app called DutySnap.
Given a spoken transcript, extract a structured command. Return ONLY valid JSON matching one of these formats:

Capture command:
{"type":"capture","confidence":0.9}

Ship from country:
{"type":"ship_from","confidence":0.9,"countryCode":"US","countryName":"United States"}

Ship to country:
{"type":"ship_to","confidence":0.9,"countryCode":"FR","countryName":"France"}

Product info (name and/or value):
{"type":"product_info","confidence":0.9,"productName":"leather handbag","productValue":200,"currency":"EUR"}

Navigation:
{"type":"navigation","confidence":0.9,"destination":"back|history|home"}

If the transcript does not match any command, return:
{"type":null,"confidence":0}

Use ISO 2-letter country codes. Currency defaults to EUR if not specified. Confidence should be 0.0-1.0 based on how clear the intent is.`;

/**
 * POST /api/parse-voice
 * Tier 2 fallback: uses Claude to parse natural language voice commands
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { transcript } = ParseVoiceSchema.parse(req.body);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
      return;
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      res.status(502).json({ error: 'No text response from LLM' });
      return;
    }

    const parsed = JSON.parse(textBlock.text);
    res.json({
      ...parsed,
      rawTranscript: transcript,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Voice parse error:', error);
    res.status(500).json({
      error: 'Failed to parse voice command',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
