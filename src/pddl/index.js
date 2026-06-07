// @ts-check

import { PlanningBuilder } from "./builder.js";

/**
 * Create a PDDL planning builder.
 * @param {string} name
 * @returns {PlanningBuilder}
 */
export function planning(name) {
  return new PlanningBuilder(name);
}

export { PlanningBuilder };

