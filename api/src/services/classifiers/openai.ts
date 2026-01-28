import OpenAI from 'openai';
import type { ClassificationInput, ClassificationResult } from '../../types/classification.js';

const HS_CODE_SYSTEM_PROMPT = `You are an expert customs classification specialist with deep knowledge of the Harmonized System (HS) codes used for international trade.

Your task is to analyze product images and descriptions to determine the most accurate HS code for customs classification.

When classifying products:
1. Identify the product type, material composition, and intended use
2. Consider the General Rules of Interpretation (GRI)
3. Provide the most specific HS code possible (6-10 digits)
4. For EU/France imports, provide the 8-digit CN (Combined Nomenclature) code when possible

Response format (JSON only, no markdown):
{
  "hsCode": "XXXX.XX.XXXX",
  "hsCode6": "XXXX.XX",
  "hsCode8": "XXXX.XX.XX",
  "description": "Official HS description for this code",
  "confidence": 0.85,
  "reasoning": "Brief explanation of classification logic",
  "productIdentified": "What product you identified in the image"
}

Be precise and conservative with confidence scores. Only high confidence (>0.8) for clear, unambiguous products.`;

export async function classifyWithOpenAI(
  input: ClassificationInput
): Promise<ClassificationResult> {
  const startTime = Date.now();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      provider: 'openai',
      hsCode: '',
      hsCode6: '',
      description: '',
      confidence: 0,
      latencyMs: Date.now() - startTime,
      error: 'OPENAI_API_KEY not configured',
    };
  }

  const client = new OpenAI({ apiKey });

  try {
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [];

    // Build text prompt first
    let textPrompt = 'Classify this product for customs import to France.\n\n';
    if (input.productName) {
      textPrompt += `Product Name: ${input.productName}\n`;
    }
    if (input.productDescription) {
      textPrompt += `Description: ${input.productDescription}\n`;
    }
    if (input.originCountry) {
      textPrompt += `Origin Country: ${input.originCountry}\n`;
    }
    textPrompt += `\nDestination: ${input.shipToCountry || 'France (FR)'}\n`;
    textPrompt += '\nProvide the HS code classification in JSON format only (no markdown code blocks).';

    content.push({ type: 'text', text: textPrompt });

    // Add image if provided
    if (input.imageBase64) {
      content.push({
        type: 'image_url',
        image_url: {
          url: input.imageBase64,
          detail: 'high',
        },
      });
    } else if (input.imageUrl) {
      content.push({
        type: 'image_url',
        image_url: {
          url: input.imageUrl,
          detail: 'high',
        },
      });
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: HS_CODE_SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    });

    const latencyMs = Date.now() - startTime;

    const textResponse = response.choices[0]?.message?.content;
    if (!textResponse) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON from response (handle potential markdown code blocks)
    const cleanedResponse = textResponse.replace(/```json\n?|\n?```/g, '');
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      provider: 'openai',
      hsCode: parsed.hsCode?.replace(/\./g, '') || '',
      hsCode6: parsed.hsCode6?.replace(/\./g, '') || parsed.hsCode?.replace(/\./g, '').slice(0, 6) || '',
      hsCode8: parsed.hsCode8?.replace(/\./g, ''),
      description: parsed.description || '',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning,
      rawResponse: parsed,
      latencyMs,
    };
  } catch (error) {
    return {
      provider: 'openai',
      hsCode: '',
      hsCode6: '',
      description: '',
      confidence: 0,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
