// @ts-check

import { FeasblClient, lp } from "../src/index.js";

const apiKey = process.argv[2] ?? process.env.FEASBL_API_KEY;
const baseUrl = process.env.FEASBL_API_BASE_URL;
const computeTierId = process.env.FEASBL_COMPUTE_TIER_ID ?? "T1";
const timeLimitS = Number(process.env.FEASBL_TIME_LIMIT_S ?? "60");

if (!apiKey) {
  console.error("Usage: npm run smoketest -- <fsbl_api_key>");
  console.error("Optional env: FEASBL_API_BASE_URL, FEASBL_COMPUTE_TIER_ID, FEASBL_TIME_LIMIT_S");
  process.exit(2);
}

const model = lp("sdk_smoke_test");
const x = model.real("x", { min: 0, max: 10 });
model.constraint("lower-bound", model.ge(x, 1));
model.minimize(x);

const client = new FeasblClient({ apiKey, baseUrl });

try {
  const result = await client.submit(model, { computeTierId, timeLimitS });
  console.log(`submitted ${result.jobId} (${result.status})`);
  console.log(`effective_time_limit_s=${result.effectiveTimeLimitS}`);
  if (result.maxCreditCost !== undefined) console.log(`max_credit_cost=${result.maxCreditCost}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
