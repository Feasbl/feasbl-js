// @ts-check

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { mkdtemp, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const here = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

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

/**
 * Assert generated Jia can be parsed by the standalone `jia-parse` binary.
 * @param {string} content
 * @returns {Promise<void>}
 */
export async function assertJiaParses(content) {
  const dir = await mkdtemp(join(tmpdir(), "feasbl-js-jia-"));
  const file = join(dir, "model.jia");
  await writeFile(file, content);

  await runJiaParse(["jia", "--validate", file]);
}

/**
 * Assert generated PDDL can be parsed by the standalone `jia-parse` binary.
 * @param {{ "domain.pddl": string, "problem.pddl": string }} files
 * @returns {Promise<void>}
 */
export async function assertPddlParses(files) {
  const dir = await mkdtemp(join(tmpdir(), "feasbl-js-pddl-"));
  const domain = join(dir, "domain.pddl");
  const problem = join(dir, "problem.pddl");
  await writeFile(domain, files["domain.pddl"]);
  await writeFile(problem, files["problem.pddl"]);

  await runJiaParse(["pddl", "--domain", domain, "--problem", problem, "--validate"]);
}

/**
 * @param {string[]} args
 * @returns {Promise<void>}
 */
async function runJiaParse(args) {
  const bin = await findJiaParse();
  await execFileAsync(bin, args, {
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
}

/** @returns {Promise<string>} */
async function findJiaParse() {
  const candidates = [
    process.env.JIA_PARSE_BIN,
    "jia-parse",
    join(homedir(), ".cargo", "bin", "jia-parse"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "jia-parse") {
      try {
        await execFileAsync(candidate, ["--version"]);
        return candidate;
      } catch {
        continue;
      }
    }

    try {
      await access(String(candidate), constants.X_OK);
      return String(candidate);
    } catch {
      continue;
    }
  }

  throw new Error(
    "jia-parse binary is required for golden tests. Install with `cargo install jia-parse --version 1.0.0 --locked` or set JIA_PARSE_BIN.",
  );
}
