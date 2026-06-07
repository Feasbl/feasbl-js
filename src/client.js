// @ts-check

/**
 * @typedef {{ [path: string]: string }} FileMap
 * @typedef {{ toFiles: () => FileMap }} FileBackedModel
 * @typedef {{ filePath: string, kind: "domain" | "problem" | "model", content: string }} InlineInput
 * @typedef {{ apiKey?: string, baseUrl?: string, fetch?: typeof globalThis.fetch }} ClientOptions
 * @typedef {{ computeTierId: string, timeLimitS?: number }} SubmitOptions
 * @typedef {{ jobId: string, status: string, effectiveTimeLimitS: number, maxCreditCost?: number }} SubmitResult
 */

export class FeasblClient {
  /**
   * Create a Feasbl API client for direct model submission.
   * @param {ClientOptions} [options] Client configuration; `apiKey` defaults to `FEASBL_API_KEY`.
   */
  constructor(options = {}) {
    /** @type {string | undefined} */
    this.apiKey = options.apiKey ?? readApiKey();
    /** @type {string} */
    this.baseUrl = (options.baseUrl ?? "https://api.feasbl.com").replace(/\/$/, "");
    /** @type {typeof globalThis.fetch} */
    this.fetch = options.fetch ?? globalThis.fetch;
    if (!this.fetch) throw new Error("A fetch implementation is required");
  }

  /**
   * Submit a generated Jia or PDDL model directly to the Feasbl jobs API.
   * @param {FileBackedModel} model Object exposing `toFiles()`.
   * @param {SubmitOptions} options Compute tier and runtime limits for the job.
   * @returns {Promise<SubmitResult>}
   */
  async submit(model, options) {
    if (!this.apiKey) throw new Error("Missing Feasbl API key");
    const body = {
      computeTierId: options.computeTierId,
      timeLimitS: options.timeLimitS,
      inputs: filesToInputs(model.toFiles()).map(input => ({
        filePath: input.filePath,
        kind: input.kind,
        content: input.content,
      })),
    };

    const response = await this.fetch(`${this.baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Feasbl job submission failed: ${response.status} ${explainFailure(text)}`);
    }

    const payload = await response.json();
    return {
      jobId: String(payload.jobId ?? payload.job_id),
      status: String(payload.status),
      effectiveTimeLimitS: Number(payload.effectiveTimeLimitS ?? payload.effective_time_limit_s),
      maxCreditCost:
        payload.maxCreditCost === undefined && payload.max_credit_cost === undefined
          ? undefined
          : Number(payload.maxCreditCost ?? payload.max_credit_cost),
    };
  }
}

/**
 * Add context for common deployment/auth mismatches.
 * @param {string} responseText
 * @returns {string}
 */
function explainFailure(responseText) {
  if (responseText.includes('"reason":"missing_token"')) {
    return `${responseText} (the direct SDK job endpoint is probably not deployed at this base URL yet; the request hit a session-auth route)`;
  }
  return responseText;
}

/**
 * Convert generated SDK files into inline job inputs accepted by the API.
 * @param {FileMap} files Map from generated file path to file contents.
 * @returns {InlineInput[]}
 */
export function filesToInputs(files) {
  return Object.entries(files).map(([filePath, content]) => ({
    filePath,
    kind: inferKind(filePath),
    content,
  }));
}

/**
 * Infer the Feasbl artifact kind from a generated filename.
 * @param {string} filePath Generated file path, such as `model.jia` or `domain.pddl`.
 * @returns {"domain" | "problem" | "model"}
 */
export function inferKind(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".jia")) return "model";
  if (lower.includes("domain") && lower.endsWith(".pddl")) return "domain";
  if (lower.includes("problem") && lower.endsWith(".pddl")) return "problem";
  throw new Error(`Cannot infer Feasbl input kind for ${filePath}`);
}

/** @returns {string | undefined} */
function readApiKey() {
  const globals = /** @type {Record<string, unknown>} */ (globalThis);
  const proc = /** @type {{ env?: { FEASBL_API_KEY?: string } } | undefined} */ (globals.process);
  return proc?.env?.FEASBL_API_KEY;
}
