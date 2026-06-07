// @ts-check

import { JiaBuilder } from "./builder.js";

/**
 * Create a linear-programming Jia builder.
 * @param {string} name
 * @returns {JiaBuilder}
 */
export function lp(name) {
  return new JiaBuilder("lp", name);
}

/**
 * Create a constraint-programming Jia builder.
 * @param {string} name
 * @returns {JiaBuilder}
 */
export function cp(name) {
  return new JiaBuilder("cp", name);
}

export { JiaBuilder };

