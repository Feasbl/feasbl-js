// @ts-check

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Assert generated output exactly matches a golden file.
 * @param {string} name
 * @param {string} actual
 * @returns {Promise<void>}
 */
export async function assertGolden(name, actual) {
  const expected = await readFile(join(here, "golden", name), "utf8");
  assert.equal(actual, expected);
}
