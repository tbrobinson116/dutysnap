/**
 * Test script for running A/B comparisons
 *
 * Usage:
 *   npx tsx scripts/test-comparison.ts
 *
 * Make sure to set environment variables:
 *   ANTHROPIC_API_KEY, ZONOS_API_KEY
 */

import 'dotenv/config';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

interface TestCase {
  name: string;
  productName?: string;
  productDescription?: string;
  imageUrl?: string;
  productValue?: number;
  originCountry?: string;
}

const testCases: TestCase[] = [
  {
    name: 'Leather Handbag',
    productName: 'Leather handbag',
    productDescription: 'Women\'s genuine leather handbag with gold hardware, made in Italy',
    productValue: 250,
    originCountry: 'IT',
  },
  {
    name: 'Running Shoes',
    productName: 'Athletic running shoes',
    productDescription: 'Men\'s running shoes with rubber sole and textile upper, Nike brand',
    productValue: 120,
    originCountry: 'VN',
  },
  {
    name: 'Wireless Headphones',
    productName: 'Bluetooth wireless headphones',
    productDescription: 'Over-ear noise cancelling wireless headphones with built-in microphone',
    productValue: 300,
    originCountry: 'CN',
  },
  {
    name: 'Cotton T-Shirt',
    productName: '100% cotton t-shirt',
    productDescription: 'Men\'s short-sleeve cotton t-shirt, solid color',
    productValue: 25,
    originCountry: 'BD',
  },
  {
    name: 'Smartwatch',
    productName: 'Smart fitness watch',
    productDescription: 'Digital smartwatch with heart rate monitor, GPS, and touchscreen display',
    productValue: 400,
    originCountry: 'CN',
  },
];

async function runTest(testCase: TestCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${testCase.name}`);
  console.log('='.repeat(60));

  try {
    const response = await fetch(`${API_BASE}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: testCase.productName,
        productDescription: testCase.productDescription,
        imageUrl: testCase.imageUrl,
        productValue: testCase.productValue,
        originCountry: testCase.originCountry,
        shipToCountry: 'FR',
        calculateDuty: !!testCase.productValue,
        providers: ['anthropic', 'zonos'],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      return;
    }

    const result = await response.json();

    // Display classifications
    console.log('\n📊 Classifications:');
    console.log('-'.repeat(40));

    for (const provider of ['anthropic', 'zonos'] as const) {
      const classification = result.classifications[provider];
      if (classification) {
        console.log(`\n${provider.toUpperCase()}:`);
        if (classification.error) {
          console.log(`  ❌ Error: ${classification.error}`);
        } else {
          console.log(`  HS Code:    ${classification.hsCode || 'N/A'}`);
          console.log(`  HS6:        ${classification.hsCode6 || 'N/A'}`);
          console.log(`  Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
          console.log(`  Latency:    ${classification.latencyMs}ms`);
          if (classification.description) {
            console.log(`  Description: ${classification.description.slice(0, 60)}...`);
          }
        }
      }
    }

    // Display duty calculations
    if (result.dutyCalculations) {
      console.log('\n💶 Duty Calculations:');
      console.log('-'.repeat(40));

      for (const provider of ['anthropic', 'zonos'] as const) {
        const duty = result.dutyCalculations[provider];
        if (duty) {
          console.log(`\n${provider.toUpperCase()} (HS: ${duty.hsCode}):`);
          if (duty.error) {
            console.log(`  ❌ Error: ${duty.error}`);
          } else {
            console.log(`  Duties: €${duty.duties.amount.toFixed(2)} (${duty.duties.rate})`);
            console.log(`  VAT:    €${duty.vat.amount.toFixed(2)} (${duty.vat.rate})`);
            console.log(`  Total:  €${duty.totalLandedCost.toFixed(2)}`);
          }
        }
      }
    }

    // Display analysis
    console.log('\n🔍 Analysis:');
    console.log('-'.repeat(40));
    console.log(`HS6 Match (Anthropic vs Zonos): ${result.analysis.hsCodeMatch.hs6Match.anthropicVsZonos ? '✓' : '✗'}`);
    console.log(`Exact Match: ${result.analysis.hsCodeMatch.anthropicVsZonos ? '✓' : '✗'}`);
    if (result.analysis.notes) {
      console.log(`Notes: ${result.analysis.notes}`);
    }

    return result;
  } catch (error) {
    console.error('Failed to run test:', error);
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          DutySnap A/B Classification Test Suite           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Check API is running
  try {
    const health = await fetch(`${API_BASE}/health`);
    if (!health.ok) throw new Error('API not responding');
    console.log(`\n✓ API is running at ${API_BASE}`);
  } catch {
    console.error(`\n✗ API is not running at ${API_BASE}`);
    console.log('  Start the API first: npm run dev');
    process.exit(1);
  }

  // Run all tests
  const results = [];
  for (const testCase of testCases) {
    const result = await runTest(testCase);
    if (result) results.push(result);
  }

  // Summary
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('                      SUMMARY');
  console.log('═'.repeat(60));

  let hs6Matches = 0;
  let exactMatches = 0;

  for (const result of results) {
    if (result.analysis.hsCodeMatch.hs6Match.anthropicVsZonos) hs6Matches++;
    if (result.analysis.hsCodeMatch.anthropicVsZonos) exactMatches++;
  }

  console.log(`\nTests Run:        ${results.length}`);
  console.log(`HS6 Matches:      ${hs6Matches}/${results.length} (${((hs6Matches/results.length)*100).toFixed(0)}%)`);
  console.log(`Exact HS Matches: ${exactMatches}/${results.length} (${((exactMatches/results.length)*100).toFixed(0)}%)`);
  console.log('');
}

main().catch(console.error);
