// @ts-check

import { JiaBuilder } from "./builder.js";

/**
 * Create a builder for a linear-programming `.jia` model.
 * @param {string} name Model identifier used in the generated source and filename.
 * @returns {JiaBuilder}
 */
export function lp(name) {
  return new JiaBuilder("lp", name);
}

/**
 * Create a builder for a constraint-programming `.jia` model.
 * @param {string} name Model identifier used in the generated source and filename.
 * @returns {JiaBuilder}
 */
export function cp(name) {
  return new JiaBuilder("cp", name);
}

export { JiaBuilder };
