// @ts-check

import { PlanningBuilder } from "./builder.js";

/**
 * Create a builder for PDDL domain/problem files.
 * @param {string} name Domain and problem base name.
 * @returns {PlanningBuilder}
 */
export function planning(name) {
  return new PlanningBuilder(name);
}

export { PlanningBuilder };
