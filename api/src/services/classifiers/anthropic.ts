import Anthropic from '@anthropic-ai/sdk';
import type { ClassificationInput, ClassificationResult } from '../../types/classification.js';

const HS_CODE_SYSTEM_PROMPT = `You are an expert customs classification specialist with deep knowledge of the Harmonized System (HS) codes used for international trade.

Your task is to analyze product images and descriptions to determine the most accurate HS code for customs classification. You must also estimate the retail value of the product in EUR.

When classifying products:
1. Identify the product type, material composition, and intended use
2. Consider the General Rules of Interpretation (GRI)
3. Provide the most specific HS code possible (6-10 digits)
4. For EU imports, provide the 8-digit CN (Combined Nomenclature) code when possible. For US imports, provide the HTS code.
5. Estimate the retail market value of the product in EUR based on the image, brand indicators, material quality, and product category

Response format (JSON):
{
  "hsCode": "XXXX.XX.XXXX", // Full HS code with dots for readability
  "hsCode6": "XXXX.XX",     // Universal 6-digit code
  "hsCode8": "XXXX.XX.XX",  // EU 8-digit CN code if applicable
  "description": "Official HS description for this code",
  "confidence": 0.85,       // 0-1 confidence score
  "reasoning": "Brief explanation of classification logic",
  "productIdentified": "What product you identified in the image",
  "estimatedValueEUR": 150.00 // Estimated retail value in EUR
}

Be precise and conservative with confidence scores. Only high confidence (>0.8) for clear, unambiguous products. For value estimation, provide your best estimate based on visible brand, quality, and product category. If uncertain, estimate conservatively.`;

export async function classifyWithAnthropic(
  input: ClassificationInput
): Promise<ClassificationResult> {
  const startTime = Date.now();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      provider: 'anthropic',
      hsCode: '',
      hsCode6: '',
      description: '',
      confidence: 0,
      latencyMs: Date.now() - startTime,
      error: 'ANTHROPIC_API_KEY not configured',
    };
  }

  const client = new Anthropic({ apiKey });

  try {
    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

    // Add image if provided
    if (input.imageBase64) {
      // Extract media type and base64 data
      const matches = input.imageBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: matches[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: matches[2],
          },
        });
      }
    } else if (input.imageUrl) {
      content.push({
        type: 'image',
        source: {
          type: 'url',
          url: input.imageUrl,
        },
      });
    }

    // Build text prompt
    const destination = input.shipToCountry || 'US';
    let textPrompt = `Classify this product for customs import to ${destination}.\n\n`;
    if (input.productName) {
      textPrompt += `Product Name: ${input.productName}\n`;
    }
    if (input.productDescription) {
      textPrompt += `Description: ${input.productDescription}\n`;
    }
    if (input.originCountry) {
      textPrompt += `Origin Country: ${input.originCountry}\n`;
    }
    textPrompt += `\nDestination: ${destination}\n`;
    textPrompt += '\nProvide the HS code classification in JSON format.';

    content.push({ type: 'text', text: textPrompt });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: HS_CODE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const latencyMs = Date.now() - startTime;

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Anthropic');
    }

    // Parse JSON from response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      provider: 'anthropic',
      hsCode: parsed.hsCode?.replace(/\./g, '') || '',
      hsCode6: parsed.hsCode6?.replace(/\./g, '') || parsed.hsCode?.replace(/\./g, '').slice(0, 6) || '',
      hsCode8: parsed.hsCode8?.replace(/\./g, ''),
      description: parsed.description || '',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning,
      estimatedValueEUR: typeof parsed.estimatedValueEUR === 'number' ? parsed.estimatedValueEUR : undefined,
      rawResponse: parsed,
      latencyMs,
    };
  } catch (error) {
    return {
      provider: 'anthropic',
      hsCode: '',
      hsCode6: '',
      description: '',
      confidence: 0,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
