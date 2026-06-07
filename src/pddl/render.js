// @ts-check

import { PddlExpr, PddlObject, PddlParam } from "./ast.js";

/** @typedef {import("./builder.js").PlanningBuilder} PlanningBuilder */
/** @typedef {import("./ast.js").PddlActionNode} PddlActionNode */
/** @typedef {import("./ast.js").PddlValue} PddlValue */
/** @typedef {import("./ast.js").TemporalBlock} TemporalBlock */
/** @typedef {import("./ast.js").PddlExprNode["kind"]} PddlExprKind */
/** @typedef {import("./ast.js").PddlType} PddlType */
/** @typedef {"at start" | "over all" | "at end"} TemporalLabel */

/** @param {PlanningBuilder} plan @returns {string} */
export function renderDomainPddl(plan) {
  const lines = [`(define (domain ${plan.name})`, `  (:requirements ${renderRequirements(plan)})`];
  if (plan.types.length > 0) lines.push(`  (:types ${plan.types.map(t => t.name).join(" ")})`);
  if (plan.predicates.length > 0) {
    lines.push("  (:predicates");
    for (const predicate of plan.predicates) lines.push(`    (${predicate.pddlName}${renderTypedList(predicate.pddlTypes)})`);
    lines.push("  )");
  }
  if (plan.functions.length > 0) {
    lines.push("  (:functions");
    for (const fn of plan.functions) lines.push(`    (${fn.pddlName}${renderTypedList(fn.pddlTypes)})`);
    lines.push("  )");
  }
  for (const action of plan.actions) {
    lines.push("");
    lines.push(...renderAction(action).map(line => `  ${line}`));
  }
  lines.push(")");
  return `${lines.join("\n")}\n`;
}

/** @param {PlanningBuilder} plan @returns {string} */
export function renderProblemPddl(plan) {
  const lines = [`(define (problem ${plan.name}_problem)`, `  (:domain ${plan.name})`];
  if (plan.objects.length > 0) {
    lines.push("  (:objects");
    for (const group of groupByType(plan.objects)) lines.push(`    ${group.names.join(" ")} - ${group.type}`);
    lines.push("  )");
  }
  lines.push("  (:init");
  for (const fact of plan.init) lines.push(`    ${renderInitExpr(fact)}`);
  lines.push("  )");
  lines.push("  (:goal");
  lines.push(...renderExprLines(plan.goalExpr ?? new PddlExpr("and", { items: [] }), 4));
  lines.push("  )");
  lines.push(")");
  return `${lines.join("\n")}\n`;
}

/** @param {PddlActionNode} action @returns {string[]} */
export function renderAction(action) {
  if (action.kind === "action") {
    return [
      `(:action ${action.name}`,
      `  :parameters (${renderParams(action.params)})`,
      "  :precondition",
      ...renderExprLines(action.body.preconditions ?? new PddlExpr("and", { items: [] }), 4),
      "  :effect",
      ...renderExprLines(action.body.effects ?? new PddlExpr("and", { items: [] }), 4),
      ")",
    ];
  }

  return [
    `(:durative-action ${action.name}`,
    `  :parameters (${renderParams(action.params)})`,
    `  :duration ${renderExpr(action.body.duration)}`,
    "  :condition",
    ...renderExprLines(renderTemporalBlock(action.body.conditions ?? {}, "condition"), 4),
    "  :effect",
    ...renderExprLines(renderTemporalBlock(action.body.effects ?? {}, "effect"), 4),
    ")",
  ];
}

/** @param {TemporalBlock} block @param {"condition" | "effect"} kind @returns {PddlExpr} */
export function renderTemporalBlock(block, kind) {
  /** @type {PddlExpr[]} */
  const items = [];
  if (block.start) addTemporal(items, "at start", block.start);
  if (block.overAll) addTemporal(items, "over all", block.overAll);
  if (block.end) addTemporal(items, "at end", block.end);
  if (items.length === 0) return new PddlExpr("and", { items: [] });
  if (items.length === 1 && kind === "condition") return items[0];
  return new PddlExpr("and", { items });
}

/** @param {PddlExpr[]} items @param {TemporalLabel} label @param {PddlExpr} expr @returns {void} */
export function addTemporal(items, label, expr) {
  if (expr instanceof PddlExpr && expr.kind === "and") {
    for (const item of requireItems(expr)) items.push(new PddlExpr("temporal", { label, expr: item }));
    return;
  }
  items.push(new PddlExpr("temporal", { label, expr }));
}

/** @param {PddlValue} expr @returns {string} */
export function renderExpr(expr) {
  if (expr instanceof PddlParam || expr instanceof PddlObject) return renderTerm(expr);
  if (typeof expr === "number") return formatNumber(expr);
  if (!(expr instanceof PddlExpr)) throw new Error(`Expected PDDL expression, got ${String(expr)}`);
  if (expr.kind === "predicate") return renderNamedCall(expr);
  if (expr.kind === "function") return renderNamedCall(expr);
  if (expr.kind === "duration") return "?duration";
  if (expr.kind === "and") return requireItems(expr).length === 0 ? "(and)" : `(and ${requireItems(expr).map(renderExpr).join(" ")})`;
  if (expr.kind === "or") return `(or ${requireItems(expr).map(renderExpr).join(" ")})`;
  if (expr.kind === "not") return `(not ${renderExpr(requireExpr(expr))})`;
  if (expr.kind === "comparison") return `(${requireOp(expr)} ${renderExpr(requireLeft(expr))} ${renderExpr(requireRight(expr))})`;
  if (expr.kind === "numericEffect") return `(${requireNumericOp(expr)} ${renderExpr(requireTarget(expr))} ${renderExpr(requireValue(expr))})`;
  if (expr.kind === "temporal") return `(${requireLabel(expr)} ${renderExpr(requireExpr(expr))})`;
  throw new Error(`Unknown PDDL expression kind ${expr.kind}`);
}

/** @param {PddlValue} expr @param {number} indent @returns {string[]} */
export function renderExprLines(expr, indent) {
  const pad = " ".repeat(indent);
  if (!(expr instanceof PddlExpr)) return [`${pad}${renderExpr(expr)}`];
  if (expr.kind === "and" || expr.kind === "or") {
    const items = requireItems(expr);
    if (items.length === 0) return [`${pad}(${expr.kind})`];
    return [`${pad}(${expr.kind}`, ...items.flatMap(item => renderExprLines(item, indent + 2)), `${pad})`];
  }
  return [`${pad}${renderExpr(expr)}`];
}

/** @param {PddlValue} expr @returns {string} */
export function renderInitExpr(expr) {
  if (expr instanceof PddlExpr && expr.kind === "numericEffect" && expr.op === "assign") {
    return `(= ${renderExpr(requireTarget(expr))} ${renderExpr(requireValue(expr))})`;
  }
  return renderExpr(expr);
}

/** @param {PddlParam[]} params @returns {string} */
export function renderParams(params) {
  return params.map(param => `?${param.name} - ${param.type.name}`).join(" ");
}

/** @param {PddlType[]} types @returns {string} */
export function renderTypedList(types) {
  return types.length ? ` ${types.map((type, index) => `?x${index + 1} - ${type.name}`).join(" ")}` : "";
}

/** @param {PlanningBuilder} plan @returns {string} */
export function renderRequirements(plan) {
  const requirements = new Set([":strips", ":typing"]);
  if (plan.actions.some(action => action.kind === "durative")) requirements.add(":durative-actions");
  if (plan.functions.length > 0) requirements.add(":numeric-fluents");
  if (hasConditionKind(plan, "not")) requirements.add(":negative-preconditions");
  if (hasConditionKind(plan, "or")) requirements.add(":disjunctive-preconditions");
  return Array.from(requirements).join(" ");
}

/** @param {PlanningBuilder} plan @param {PddlExprKind} kind @returns {boolean} */
export function hasConditionKind(plan, kind) {
  /** @type {(PddlExpr | null | undefined)[]} */
  const conditionRoots = [plan.goalExpr];
  for (const action of plan.actions) {
    if (action.kind === "action") conditionRoots.push(action.body.preconditions);
    else conditionRoots.push(...Object.values(action.body.conditions ?? {}));
  }
  /** @param {unknown} expr @returns {boolean} */
  const visit = expr => {
    if (!(expr instanceof PddlExpr)) return false;
    if (expr.kind === kind) return true;
    const node = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (expr));
    return ["items", "expr", "left", "right", "target", "value"].some(key => {
      const value = node[key];
      if (Array.isArray(value)) return value.some(visit);
      return visit(value);
    });
  };
  return conditionRoots.some(visit);
}

/** @param {PddlParam | PddlObject | PddlExpr} term @returns {string} */
export function renderTerm(term) {
  if (term instanceof PddlParam) return `?${term.name}`;
  if (term instanceof PddlObject) return term.name;
  if (term instanceof PddlExpr) return renderExpr(term);
  throw new Error(`Expected PDDL term, got ${String(term)}`);
}

/** @param {PddlObject[]} objects @returns {{ type: string, names: string[] }[]} */
function groupByType(objects) {
  /** @type {{ type: string, names: string[] }[]} */
  const groups = [];
  for (const object of objects) {
    let group = groups.find(candidate => candidate.type === object.type.name);
    if (!group) {
      group = { type: object.type.name, names: [] };
      groups.push(group);
    }
    group.names.push(object.name);
  }
  return groups;
}

/** @param {number} value @returns {string} */
function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(value);
}

/** @param {PddlExpr} expr @returns {string} */
function renderNamedCall(expr) {
  const name = requireName(expr);
  const args = requireArgs(expr);
  return `(${name}${args.length ? ` ${args.map(renderExpr).join(" ")}` : ""})`;
}

/** @param {PddlExpr} expr @returns {string} */
function requireName(expr) {
  if (expr.name === undefined) throw new Error(`Expected ${expr.kind} expression to contain a name`);
  return expr.name;
}

/** @param {PddlExpr} expr @returns {PddlValue[]} */
function requireArgs(expr) {
  if (expr.args === undefined) throw new Error(`Expected ${expr.kind} expression to contain args`);
  return expr.args;
}

/** @param {PddlExpr} expr @returns {PddlExpr[]} */
function requireItems(expr) {
  if (expr.items === undefined) throw new Error(`Expected ${expr.kind} expression to contain items`);
  return expr.items;
}

/** @param {PddlExpr} expr @returns {PddlExpr} */
function requireExpr(expr) {
  if (expr.expr === undefined) throw new Error(`Expected ${expr.kind} expression to contain expr`);
  return expr.expr;
}

/** @param {PddlExpr} expr @returns {"=" | ">=" | "<=" | ">" | "<"} */
function requireOp(expr) {
  if (expr.op !== "=" && expr.op !== ">=" && expr.op !== "<=" && expr.op !== ">" && expr.op !== "<") {
    throw new Error(`Expected ${expr.kind} expression to contain a comparison op`);
  }
  return expr.op;
}

/** @param {PddlExpr} expr @returns {"assign" | "increase" | "decrease"} */
function requireNumericOp(expr) {
  if (expr.op !== "assign" && expr.op !== "increase" && expr.op !== "decrease") {
    throw new Error(`Expected ${expr.kind} expression to contain a numeric effect op`);
  }
  return expr.op;
}

/** @param {PddlExpr} expr @returns {PddlValue} */
function requireLeft(expr) {
  if (expr.left === undefined) throw new Error(`Expected ${expr.kind} expression to contain left`);
  return expr.left;
}

/** @param {PddlExpr} expr @returns {PddlValue} */
function requireRight(expr) {
  if (expr.right === undefined) throw new Error(`Expected ${expr.kind} expression to contain right`);
  return expr.right;
}

/** @param {PddlExpr} expr @returns {PddlExpr} */
function requireTarget(expr) {
  if (expr.target === undefined) throw new Error(`Expected ${expr.kind} expression to contain target`);
  return expr.target;
}

/** @param {PddlExpr} expr @returns {PddlValue} */
function requireValue(expr) {
  if (expr.value === undefined) throw new Error(`Expected ${expr.kind} expression to contain value`);
  return expr.value;
}

/** @param {PddlExpr} expr @returns {TemporalLabel} */
function requireLabel(expr) {
  if (expr.label === undefined) throw new Error(`Expected ${expr.kind} expression to contain label`);
  return expr.label;
}
