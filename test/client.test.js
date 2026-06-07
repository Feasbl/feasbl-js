// @ts-check

import assert from "node:assert/strict";
import test from "node:test";

import { FeasblClient, filesToInputs, inferKind, solve } from "../src/index.js";

test("inferKind maps generated Jia and PDDL files", () => {
  assert.equal(inferKind("model.jia"), "model");
  assert.equal(inferKind("domain.pddl"), "domain");
  assert.equal(inferKind("problem.pddl"), "problem");
  assert.throws(() => inferKind("notes.txt"), /Cannot infer/);
});

test("filesToInputs converts generated files to inline API inputs", () => {
  assert.deepEqual(filesToInputs({ "model.jia": "@model cp\nmodel demo\n" }), [
    { filePath: "model.jia", kind: "model", content: "@model cp\nmodel demo\n" },
  ]);
});

test("client posts direct job submissions", async () => {
  /** @type {RequestInit | undefined} */
  let captured;
  const client = new FeasblClient({
    apiKey: "fsbl_test",
    baseUrl: "https://api.test",
    fetch: async (_url, init) => {
      captured = init;
      return new Response(
        JSON.stringify({
          jobId: "job_1",
          status: "queued",
          effectiveTimeLimitS: 60,
          maxCreditCost: 1,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const result = await client.submit(
    { toFiles: () => ({ "model.jia": "@model cp\nmodel demo\n" }) },
    { computeTierId: "T1", timeLimitS: 60 },
  );

  assert.equal(result.jobId, "job_1");
  assert.equal(captured?.method, "POST");
  assert.equal(captured?.headers?.["authorization"], "Bearer fsbl_test");
  assert.deepEqual(JSON.parse(String(captured?.body)), {
    computeTierId: "T1",
    timeLimitS: 60,
    inputs: [{ filePath: "model.jia", kind: "model", content: "@model cp\nmodel demo\n" }],
  });
});

test("solve submits with the top-level helper", async () => {
  const result = await solve(
    { toFiles: () => ({ "model.jia": "@model lp\nmodel demo\n" }) },
    {
      apiKey: "fsbl_test",
      baseUrl: "https://api.test/",
      computeTierId: "T1",
      fetch: async url => {
        assert.equal(url, "https://api.test/api/v1/jobs");
        return new Response(
          JSON.stringify({
            job_id: "job_snake",
            status: "queued",
            effective_time_limit_s: 30,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  );

  assert.deepEqual(result, {
    jobId: "job_snake",
    status: "queued",
    effectiveTimeLimitS: 30,
    maxCreditCost: undefined,
  });
});

test("client can read the API key from the environment", async () => {
  const previous = process.env.FEASBL_API_KEY;
  process.env.FEASBL_API_KEY = "fsbl_env";

  /** @type {RequestInit | undefined} */
  let captured;
  const client = new FeasblClient({
    baseUrl: "https://api.test",
    fetch: async (_url, init) => {
      captured = init;
      return new Response(
        JSON.stringify({
          jobId: "job_2",
          status: "queued",
          effectiveTimeLimitS: 10,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  try {
    await client.submit(
      { toFiles: () => ({ "model.jia": "@model cp\nmodel demo\n" }) },
      { computeTierId: "T1" },
    );
  } finally {
    if (previous === undefined) delete process.env.FEASBL_API_KEY;
    else process.env.FEASBL_API_KEY = previous;
  }

  assert.equal(captured?.headers?.["authorization"], "Bearer fsbl_env");
});

test("client validates required API configuration", async () => {
  const originalFetch = globalThis.fetch;
  // @ts-expect-error intentionally exercising missing fetch fallback
  globalThis.fetch = undefined;
  try {
    assert.throws(() => new FeasblClient({ apiKey: "fsbl_test" }), /fetch implementation/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const client = new FeasblClient({ fetch: async () => new Response("{}") });
  await assert.rejects(
    () => client.submit({ toFiles: () => ({ "model.jia": "" }) }, { computeTierId: "T1" }),
    /Missing Feasbl API key/,
  );
});

test("client preserves generic HTTP failure bodies", async () => {
  const client = new FeasblClient({
    apiKey: "fsbl_test",
    fetch: async () => new Response("nope", { status: 500 }),
  });

  await assert.rejects(
    () => client.submit({ toFiles: () => ({ "model.jia": "" }) }, { computeTierId: "T1" }),
    /500 nope/,
  );
});

test("client explains session-auth failures from undeployed direct endpoint", async () => {
  const client = new FeasblClient({
    apiKey: "fsbl_test",
    baseUrl: "https://api.test",
    fetch: async () =>
      new Response(JSON.stringify({ message: "unauthorized", reason: "missing_token" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
  });

  await assert.rejects(
    () =>
      client.submit(
        { toFiles: () => ({ "model.jia": "@model cp\nmodel demo\n" }) },
        { computeTierId: "T1" },
      ),
    /direct SDK job endpoint is probably not deployed/,
  );
});
