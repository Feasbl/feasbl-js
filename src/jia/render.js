// @ts-check

import { JiaConstraint, JiaExpr, JiaSet, JiaVar } from "./ast.js";

/** @typedef {import("./builder.js").JiaBuilder} JiaBuilder */
/** @typedef {import("./ast.js").JiaDomainNode} JiaDomainNode */

/**
 * Render a Jia builder to a `.jia` source file.
 * @param {JiaBuilder} model
 * @returns {string}
 */
export function renderJia(model) {
  const lines = [`@model ${model.kind}`, `model ${model.name}`, "", "variables {"];
  for (const group of groupVariables(model.variables)) {
    lines.push(`  ${group.type}: ${group.names.join(", ")}`);
  }
  lines.push("}", "", "domains {");
  for (const domain of model.domains) {
    lines.push(`  ${renderDomain(domain)}`);
  }
  lines.push("}", "", "constraints {");
  for (const constraint of model.constraints) {
    lines.push(`  ${renderConstraint(requireConstraint(constraint))}`);
  }
  lines.push("}");
  if (model.objective) {
    lines.push("", `${model.objective.direction} ${renderExpr(model.objective.expr)}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Render a Jia domain statement.
 * @param {JiaDomainNode} domain
 * @returns {string}
 */
export function renderDomain(domain) {
  if (domain.kind === "range") return `${nameOf(domain.variable)} ${renderRange(domain.domain)}`;
  if (domain.kind === "intervalAttr") {
    return `${domain.attr}(${domain.vars.map(nameOf).join(", ")}) ${renderRange(domain.domain)}`;
  }
  if (domain.kind === "optional") return `optional(${domain.vars.map(nameOf).join(", ")})`;
  if (domain.kind === "set") return `${nameOf(domain.set)} = {${domain.members.map(nameOf).join(", ")}}`;
  if (domain.kind === "demand") {
    return `demand(${nameOf(domain.interval)}, ${nameOf(domain.set)}) = ${formatNumber(domain.value)}`;
  }
  throw new Error("Unknown domain kind");
}

/**
 * Render a Jia domain range or fixed value.
 * @param {import("./ast.js").JiaDomainSpec | import("./ast.js").JiaIntervalDomainSpec} domain
 * @returns {string}
 */
export function renderRange(domain) {
  if (typeof domain === "number") return `= ${formatNumber(domain)}`;
  if (domain.values) return `in {${domain.values.map(formatNumber).join(", ")}}`;
  const min = domain.min ?? 0;
  const max = domain.max ?? "inf";
  return `in ${formatNumber(min)}..${formatNumber(max)}`;
}

/**
 * Render a Jia constraint statement.
 * @param {JiaConstraint} constraint
 * @returns {string}
 */
export function renderConstraint(constraint) {
  if (constraint.kind === "comparison") {
    return `${renderExpr(requireLeft(constraint))} ${requireComparisonOp(constraint)} ${renderExpr(requireRight(constraint))}`;
  }
  if (constraint.kind === "noOverlap") return `no_overlap(${requireItems(constraint).map(nameOf).join(", ")})`;
  if (constraint.kind === "cumulative") return `cumulative(${nameOf(requireSet(constraint))}, ${renderExpr(requireCapacity(constraint))})`;
  if (constraint.kind === "span") return `span(${nameOf(requireParent(constraint))}, ${nameOf(requireSet(constraint))})`;
  if (constraint.kind === "alternative") return `alternative(${nameOf(requireParent(constraint))}, ${nameOf(requireSet(constraint))})`;
  throw new Error("Unknown constraint kind");
}

/**
 * Render a Jia expression.
 * @param {JiaExpr} expr
 * @param {number} [parentPrecedence]
 * @returns {string}
 */
export function renderExpr(expr, parentPrecedence = 0) {
  if (expr.kind === "number") return formatNumber(requireNumber(expr));
  if (expr.kind === "var") return requireName(expr);
  if (expr.kind === "call") return `${requireName(expr)}(${requireArgs(expr).join(", ")})`;
  if (expr.kind === "neg") return `-${renderExpr(requireValue(expr), 3)}`;
  if (expr.kind === "binary") {
    const op = requireArithmeticOp(expr);
    const precedence = op === "*" ? 2 : 1;
    const rendered = `${renderExpr(requireExprLeft(expr), precedence)} ${op} ${renderExpr(requireExprRight(expr), precedence + rightAssociativityBump(op))}`;
    return precedence < parentPrecedence ? `(${rendered})` : rendered;
  }
  throw new Error("Unknown expression kind");
}

/**
 * Convert a named Jia value to its source identifier.
 * @param {unknown} value
 * @returns {string}
 */
export function nameOf(value) {
  if (value instanceof JiaVar || value instanceof JiaSet) return value.name;
  if (typeof value === "string") return value;
  throw new Error(`Expected named Jia value, got ${String(value)}`);
}

/**
 * Format a number for Jia source.
 * @param {number | "inf"} value
 * @returns {string}
 */
export function formatNumber(value) {
  if (value === Infinity || value === "inf") return "inf";
  if (value === -Infinity) return "-inf";
  return Number.isInteger(value) ? String(value) : String(value);
}

/**
 * Group adjacent variable declarations of the same Jia type.
 * @param {{ type: string, value: JiaVar | JiaSet }[]} vars
 * @returns {{ type: string, names: string[] }[]}
 */
function groupVariables(vars) {
  /** @type {{ type: string, names: string[] }[]} */
  const groups = [];
  for (const variable of vars) {
    const last = groups.at(-1);
    if (last?.type === variable.type) last.names.push(variable.value.name);
    else groups.push({ type: variable.type, names: [variable.value.name] });
  }
  return groups;
}

/**
 * @param {string} op
 * @returns {number}
 */
function rightAssociativityBump(op) {
  return op === "-" ? 1 : 0;
}

/** @param {JiaConstraint} constraint @returns {JiaConstraint} */
function requireConstraint(constraint) {
  if (constraint.constraint === undefined) throw new Error("Expected named Jia constraint");
  return constraint.constraint;
}

/** @param {JiaConstraint} constraint @returns {import("./ast.js").JiaComparisonOp} */
function requireComparisonOp(constraint) {
  if (constraint.op === undefined) throw new Error("Expected Jia comparison op");
  return constraint.op;
}

/** @param {JiaConstraint} constraint @returns {JiaExpr} */
function requireLeft(constraint) {
  if (constraint.left === undefined) throw new Error("Expected Jia left expression");
  return constraint.left;
}

/** @param {JiaConstraint} constraint @returns {JiaExpr} */
function requireRight(constraint) {
  if (constraint.right === undefined) throw new Error("Expected Jia right expression");
  return constraint.right;
}

/** @param {JiaConstraint} constraint @returns {(JiaSet | JiaVar)[]} */
function requireItems(constraint) {
  if (constraint.items === undefined) throw new Error("Expected Jia constraint items");
  return constraint.items;
}

/** @param {JiaConstraint} constraint @returns {JiaSet} */
function requireSet(constraint) {
  if (constraint.set === undefined) throw new Error("Expected Jia constraint set");
  return constraint.set;
}

/** @param {JiaConstraint} constraint @returns {JiaExpr} */
function requireCapacity(constraint) {
  if (constraint.capacity === undefined) throw new Error("Expected Jia cumulative capacity");
  return constraint.capacity;
}

/** @param {JiaConstraint} constraint @returns {JiaVar} */
function requireParent(constraint) {
  if (constraint.parent === undefined) throw new Error("Expected Jia parent interval");
  return constraint.parent;
}

/** @param {JiaExpr} expr @returns {number} */
function requireNumber(expr) {
  if (expr.value === undefined || expr.value instanceof JiaExpr) throw new Error("Expected Jia number expression");
  return expr.value;
}

/** @param {JiaExpr} expr @returns {string} */
function requireName(expr) {
  if (expr.name === undefined) throw new Error("Expected Jia named expression");
  return expr.name;
}

/** @param {JiaExpr} expr @returns {string[]} */
function requireArgs(expr) {
  if (expr.args === undefined) throw new Error("Expected Jia call args");
  return expr.args;
}

/** @param {JiaExpr} expr @returns {JiaExpr} */
function requireValue(expr) {
  if (!(expr.value instanceof JiaExpr)) throw new Error("Expected Jia nested expression");
  return expr.value;
}

/** @param {JiaExpr} expr @returns {import("./ast.js").JiaArithmeticOp} */
function requireArithmeticOp(expr) {
  if (expr.op === undefined) throw new Error("Expected Jia arithmetic op");
  return expr.op;
}

/** @param {JiaExpr} expr @returns {JiaExpr} */
function requireExprLeft(expr) {
  if (expr.left === undefined) throw new Error("Expected Jia left expression");
  return expr.left;
}

/** @param {JiaExpr} expr @returns {JiaExpr} */
function requireExprRight(expr) {
  if (expr.right === undefined) throw new Error("Expected Jia right expression");
  return expr.right;
}
