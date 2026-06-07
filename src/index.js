// @ts-check

export { cp, lp } from "./jia/index.js";
export { planning } from "./pddl/index.js";
export { FeasblClient, filesToInputs, inferKind } from "./client.js";

/**
 * Submit a generated model to Feasbl.
 * @param {import("./client.js").FileBackedModel} model
 * @param {import("./client.js").SubmitOptions & import("./client.js").ClientOptions} options
 * @returns {Promise<import("./client.js").SubmitResult>}
 */
export async function solve(model, options) {
  const { FeasblClient } = await import("./client.js");
  return new FeasblClient(options).submit(model, options);
}
