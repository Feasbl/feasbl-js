// @ts-check

import { assertIdentifier, JiaConstraint, JiaExpr, JiaSet, JiaVar } from "./ast.js";
import { nameOf, renderJia } from "./render.js";

/** @typedef {import("./ast.js").JiaModelKind} JiaModelKind */
/** @typedef {import("./ast.js").JiaDomainSpec} JiaDomainSpec */
/** @typedef {import("./ast.js").JiaIntervalOptions} JiaIntervalOptions */
/** @typedef {import("./ast.js").JiaExprInput} JiaExprInput */
/** @typedef {import("./ast.js").JiaAllDifferentInput} JiaAllDifferentInput */
/** @typedef {import("./ast.js").FileMap} FileMap */
/** @typedef {import("./ast.js").JiaDomainNode} JiaDomainNode */
/** @typedef {import("./ast.js").JiaVariableKind} JiaVariableKind */

export class JiaBuilder {
  /**
   * @param {JiaModelKind} kind
   * @param {string} name
   */
  constructor(kind, name) {
    /** @type {JiaModelKind} */
    this.kind = kind;
    /** @type {string} */
    this.name = assertIdentifier(name, "model name");
    /** @type {{ type: string, value: JiaVar | JiaSet }[]} */
    this.variables = [];
    /** @type {JiaDomainNode[]} */
    this.domains = [];
    /** @type {JiaConstraint[]} */
    this.constraints = [];
    /** @type {import("./ast.js").JiaObjective | null} */
    this.objective = null;
  }

  /**
   * Declare an LP real variable.
   * @param {string} name
   * @param {JiaDomainSpec} [domain]
   * @returns {JiaVar}
   */
  real(name, domain = {}) {
    this.assertKind("lp", "real");
    const variable = this.declare("Real", name);
    this.addRangeDomain(variable, domain);
    return variable;
  }

  /**
   * Declare a CP integer variable.
   * @param {string} name
   * @param {JiaDomainSpec} [domain]
   * @returns {JiaVar}
   */
  integer(name, domain = {}) {
    this.assertKind("cp", "integer");
    const variable = this.declare("Integer", name);
    this.addRangeDomain(variable, domain);
    return variable;
  }

  /**
   * Declare a CP interval variable.
   * @param {string} name
   * @param {JiaIntervalOptions} [options]
   * @returns {JiaVar}
   */
  interval(name, options = {}) {
    this.assertKind("cp", "interval");
    const variable = this.declare("Interval", name);
    if (options.duration !== undefined) this.domains.push({ kind: "intervalAttr", attr: "duration", vars: [variable], domain: options.duration });
    if (options.start !== undefined) this.domains.push({ kind: "intervalAttr", attr: "start", vars: [variable], domain: options.start });
    if (options.end !== undefined) this.domains.push({ kind: "intervalAttr", attr: "end", vars: [variable], domain: options.end });
    if (options.optional) this.domains.push({ kind: "optional", vars: [variable] });
    return variable;
  }

  /**
   * Declare a CP interval set.
   * @param {string} name
   * @param {JiaVar[]} members
   * @returns {JiaSet}
   */
  intervalSet(name, members) {
    this.assertKind("cp", "intervalSet");
    const set = this.declareSet("Set[Interval]", name, members);
    this.domains.push({ kind: "set", set, members });
    return set;
  }

  /**
   * Declare a CP integer set.
   * @param {string} name
   * @param {JiaVar[]} members
   * @returns {JiaSet}
   */
  integerSet(name, members) {
    this.assertKind("cp", "integerSet");
    const set = this.declareSet("Set[Integer]", name, members);
    this.domains.push({ kind: "set", set, members });
    return set;
  }

  /**
   * Declare resource demand for an interval and interval set.
   * @param {JiaVar} interval
   * @param {JiaSet} set
   * @param {number} value
   * @returns {void}
   */
  demand(interval, set, value) {
    this.assertKind("cp", "demand");
    this.domains.push({ kind: "demand", interval, set, value });
  }

  /**
   * Add a named comparison constraint.
   * @param {string} name
   * @param {JiaConstraint} expr
   * @returns {void}
   */
  constraint(name, expr) {
    this.constraints.push(new JiaConstraint("named", { name, constraint: asConstraint(expr) }));
  }

  /**
   * Add a Jia no_overlap constraint.
   * @param {string} name
   * @param {JiaSet | JiaVar[]} intervalsOrSet
   * @returns {void}
   */
  noOverlap(name, intervalsOrSet) {
    this.assertKind("cp", "noOverlap");
    const items = Array.isArray(intervalsOrSet) ? intervalsOrSet : [intervalsOrSet];
    this.constraints.push(new JiaConstraint("named", { name, constraint: new JiaConstraint("noOverlap", { items }) }));
  }

  /**
   * Add a Jia cumulative resource constraint.
   * @param {string} name
   * @param {JiaSet} set
   * @param {JiaExprInput} capacity
   * @returns {void}
   */
  cumulative(name, set, capacity) {
    this.assertKind("cp", "cumulative");
    this.constraints.push(new JiaConstraint("named", { name, constraint: new JiaConstraint("cumulative", { set, capacity: asExpr(capacity) }) }));
  }

  /**
   * Add a Jia span constraint.
   * @param {string} name
   * @param {JiaVar} parent
   * @param {JiaSet} set
   * @returns {void}
   */
  span(name, parent, set) {
    this.assertKind("cp", "span");
    this.constraints.push(new JiaConstraint("named", { name, constraint: new JiaConstraint("span", { parent, set }) }));
  }

  /**
   * Add a Jia alternative constraint.
   * @param {string} name
   * @param {JiaVar} parent
   * @param {JiaSet} set
   * @returns {void}
   */
  alternative(name, parent, set) {
    this.assertKind("cp", "alternative");
    this.constraints.push(new JiaConstraint("named", { name, constraint: new JiaConstraint("alternative", { parent, set }) }));
  }

  /**
   * Add pairwise inequality constraints for all values.
   * @param {string} name
   * @param {JiaAllDifferentInput} setOrValues
   * @returns {void}
   */
  allDifferent(name, setOrValues) {
    this.assertKind("cp", "allDifferent");
    const values = setOrValues instanceof JiaSet ? setOrValues.members : setOrValues;
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        this.constraint(`${name}-${nameOf(values[i])}-${nameOf(values[j])}`, this.ne(values[i], values[j]));
      }
    }
  }

  /** @param {JiaExprInput} expr @returns {void} */
  minimize(expr) {
    this.objective = { direction: "minimize", expr: asExpr(expr) };
  }

  /** @param {JiaExprInput} expr @returns {void} */
  maximize(expr) {
    this.objective = { direction: "maximize", expr: asExpr(expr) };
  }

  /** @returns {void} */
  satisfy() {
    this.objective = null;
  }

  /** @param {...JiaExprInput} terms @returns {JiaExpr} */
  add(...terms) {
    return chainBinary("+", terms);
  }

  /** @param {JiaExprInput} left @param {JiaExprInput} right @returns {JiaExpr} */
  sub(left, right) {
    return new JiaExpr("binary", { op: "-", left: asExpr(left), right: asExpr(right) });
  }

  /** @param {...JiaExprInput} terms @returns {JiaExpr} */
  mul(...terms) {
    return chainBinary("*", terms);
  }

  /** @param {JiaExprInput} value @returns {JiaExpr} */
  neg(value) {
    return new JiaExpr("neg", { value: asExpr(value) });
  }

  /** @param {JiaExprInput} left @param {JiaExprInput} right @returns {JiaConstraint} */
  le(left, right) { return comparison("<=", left, right); }
  /** @param {JiaExprInput} left @param {JiaExprInput} right @returns {JiaConstraint} */
  ge(left, right) { return comparison(">=", left, right); }
  /** @param {JiaExprInput} left @param {JiaExprInput} right @returns {JiaConstraint} */
  lt(left, right) { return comparison("<", left, right); }
  /** @param {JiaExprInput} left @param {JiaExprInput} right @returns {JiaConstraint} */
  gt(left, right) { return comparison(">", left, right); }
  /** @param {JiaExprInput} left @param {JiaExprInput} right @returns {JiaConstraint} */
  eq(left, right) { return comparison("==", left, right); }
  /** @param {JiaExprInput} left @param {JiaExprInput} right @returns {JiaConstraint} */
  ne(left, right) { return comparison("!=", left, right); }

  /** @param {JiaVar} interval @returns {JiaExpr} */
  startOf(interval) { return new JiaExpr("call", { name: "start_of", args: [nameOf(interval)] }); }
  /** @param {JiaVar} interval @returns {JiaExpr} */
  endOf(interval) { return new JiaExpr("call", { name: "end_of", args: [nameOf(interval)] }); }
  /** @param {JiaVar} interval @returns {JiaExpr} */
  durationOf(interval) { return new JiaExpr("call", { name: "duration_of", args: [nameOf(interval)] }); }
  /** @param {JiaVar} interval @returns {JiaExpr} */
  presentOf(interval) { return new JiaExpr("call", { name: "present_of", args: [nameOf(interval)] }); }

  /** @returns {FileMap} */
  toFiles() {
    return { [`${this.name}.jia`]: this.toJia() };
  }

  /** @returns {string} */
  toJia() {
    return renderJia(this);
  }

  /** @param {JiaModelKind} kind @param {string} method @returns {void} */
  assertKind(kind, method) {
    if (this.kind !== kind) throw new Error(`${method}() is only available on ${kind} models`);
  }

  /** @param {JiaVariableKind} type @param {string} name @returns {JiaVar} */
  declare(type, name) {
    const variable = new JiaVar(type, assertIdentifier(name, "variable name"));
    this.variables.push({ type, value: variable });
    return variable;
  }

  /** @param {"Set[Interval]" | "Set[Integer]"} type @param {string} name @param {JiaVar[]} members @returns {JiaSet} */
  declareSet(type, name, members) {
    const set = new JiaSet(type, assertIdentifier(name, "set name"), members);
    this.variables.push({ type, value: set });
    return set;
  }

  /** @param {JiaVar} variable @param {JiaDomainSpec} domain @returns {void} */
  addRangeDomain(variable, domain) {
    if (domain.values) {
      this.domains.push({ kind: "range", variable, domain: { values: domain.values } });
      return;
    }
    if (domain.min !== undefined || domain.max !== undefined) this.domains.push({ kind: "range", variable, domain });
  }
}

/**
 * @param {import("./ast.js").JiaComparisonOp} op
 * @param {JiaExprInput} left
 * @param {JiaExprInput} right
 * @returns {JiaConstraint}
 */
function comparison(op, left, right) {
  return new JiaConstraint("comparison", { op, left: asExpr(left), right: asExpr(right) });
}

/** @param {unknown} value @returns {JiaConstraint} */
function asConstraint(value) {
  if (value instanceof JiaConstraint) return value;
  throw new Error("Expected a Jia constraint");
}

/** @param {JiaExprInput} value @returns {JiaExpr} */
function asExpr(value) {
  if (value instanceof JiaExpr) return value;
  if (value instanceof JiaVar) return new JiaExpr("var", { name: value.name });
  if (typeof value === "number") return new JiaExpr("number", { value });
  throw new Error(`Expected Jia expression, got ${String(value)}`);
}

/** @param {"+" | "*"} op @param {JiaExprInput[]} terms @returns {JiaExpr} */
function chainBinary(op, terms) {
  if (terms.length === 0) throw new Error("Expected at least one expression");
  return terms.map(asExpr).reduce((left, right) => new JiaExpr("binary", { op, left, right }));
}
