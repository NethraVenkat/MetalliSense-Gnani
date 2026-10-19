#!/usr/bin/env node
/**
 * MetalliSense System Verifier
 *
 * Checks that every service in the stack is actually running and
 * responding correctly — not just "is the port open" but "does it
 * return the response shape the rest of the app expects."
 *
 * Usage:
 *   node verify.js
 *
 * Run this after starting your services (Backend, AI, Agent, and
 * optionally VectorSearch) to get a single pass/fail report instead of
 * checking each one by hand.
 */
const http = require('http');

const CHECKS = [
  {
    name: 'Backend — health',
    url: 'http://localhost:3000/api/v1/health',
    required: true,
    validate: (json) => json.status === 'success',
  },
  {
    name: 'Backend — grades (CSV data loaded)',
    url: 'http://localhost:3000/api/v2/grades',
    required: true,
    validate: (json) => json.status === 'success' && Array.isArray(json.data?.data) && json.data.data.length > 0,
  },
  {
    name: 'Backend — training data',
    url: 'http://localhost:3000/api/v2/training-data/paginated?limit=1',
    required: true,
    validate: (json) => json.status === 'success' && json.pagination?.totalDocuments > 0,
  },
  {
    name: 'Backend — cost prices',
    url: 'http://localhost:3000/api/v2/cost/prices',
    required: true,
    validate: (json) => json.status === 'success' && json.data?.elementPrices,
  },
  {
    name: 'Backend — selling prices',
    url: 'http://localhost:3000/api/v2/cost/selling-prices',
    required: true,
    validate: (json) => json.status === 'success',
  },
  {
    name: 'Backend — cost savings analysis',
    url: 'http://localhost:3000/api/v2/cost/savings-analysis',
    required: true,
    validate: (json) => json.status === 'success' && json.data?.overall,
  },
  {
    name: 'AI Service — health',
    url: 'http://localhost:8000/health',
    required: false,
    validate: (json) => json.status === 'healthy' || json.status === 'success',
  },
  {
    name: 'Backend -> AI Service proxy',
    url: 'http://localhost:3000/api/v2/ai/health',
    required: false,
    validate: (json) => json.status !== undefined, // any structured response, even an error, means the proxy itself works
  },
  {
    name: 'Agent Service — docs (confirms it is up)',
    url: 'http://localhost:8001/docs',
    required: false,
    validate: () => true, // just needs to respond, not JSON
    rawOk: true,
  },
  {
    name: 'Backend -> RL policy status',
    url: 'http://localhost:3000/api/v2/rl/policy/status',
    required: false,
    validate: (json) => json.status !== undefined,
  },
  {
    name: 'VectorSearch — health (optional)',
    url: 'http://localhost:8002/health',
    required: false,
    validate: (json) => json.status === 'success',
  },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function runCheck(check) {
  try {
    const { statusCode, body } = await fetchJson(check.url);
    if (check.rawOk) {
      return { ...check, ok: statusCode < 500, detail: `HTTP ${statusCode}` };
    }
    let json;
    try {
      json = JSON.parse(body);
    } catch (e) {
      return { ...check, ok: false, detail: `Non-JSON response (HTTP ${statusCode})` };
    }
    const ok = check.validate(json);
    return { ...check, ok, detail: ok ? `HTTP ${statusCode}, response shape OK` : `HTTP ${statusCode}, unexpected response shape` };
  } catch (err) {
    return { ...check, ok: false, detail: `Not reachable (${err.message})` };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('MetalliSense System Verifier');
  console.log('='.repeat(60));
  console.log();

  const results = await Promise.all(CHECKS.map(runCheck));

  let requiredFailures = 0;
  let optionalFailures = 0;

  results.forEach((r) => {
    const icon = r.ok ? '✅' : (r.required ? '❌' : '⚠️ ');
    const tag = r.required ? '' : ' (optional)';
    console.log(`${icon} ${r.name}${tag}`);
    console.log(`   ${r.detail}`);
    if (!r.ok) {
      if (r.required) requiredFailures += 1;
      else optionalFailures += 1;
    }
  });

  console.log();
  console.log('='.repeat(60));
  if (requiredFailures === 0) {
    console.log('✅ ALL REQUIRED CHECKS PASSED — Backend + CSV data are working correctly.');
    if (optionalFailures > 0) {
      console.log(`⚠️  ${optionalFailures} optional service(s) not reachable — AI Agent / RL / Semantic Search features need those running.`);
    }
    console.log('='.repeat(60));
    process.exit(0);
  } else {
    console.log(`❌ ${requiredFailures} REQUIRED CHECK(S) FAILED — see above for which endpoint and why.`);
    console.log('   Most common cause: the Backend (npm start) is not running.');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main();
