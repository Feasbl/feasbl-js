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
   * Create a Jia model builder.
   * @param {JiaModelKind} kind Model paradigm, either linear programming or constraint programming.
   * @param {string} name Model identifier used in generated source.
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
   * Declare a real-valued variable on an LP model.
   * @param {string} name Variable identifier.
   * @param {JiaDomainSpec} [domain] Optional range or finite value domain.
   * @returns {JiaVar}
   */
  real(name, domain = {}) {
    this.assertKind("lp", "real");
    const variable = this.declare("Real", name);
    this.addRangeDomain(variable, domain);
    return variable;
  }

  /**
   * Declare an integer variable on a CP model.
   * @param {string} name Variable identifier.
   * @param {JiaDomainSpec} [domain] Optional range or finite value domain.
   * @returns {JiaVar}
   */
  integer(name, domain = {}) {
    this.assertKind("cp", "integer");
    const variable = this.declare("Integer", name);
    this.addRangeDomain(variable, domain);
    return variable;
  }

  /**
   * Declare an interval variable on a CP model.
   * @param {string} name Interval identifier.
   * @param {JiaIntervalOptions} [options] Optional duration, start, end, and optionality domains.
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
   * Declare a named set of interval variables.
   * @param {string} name Set identifier.
   * @param {JiaVar[]} members Interval variables included in the set.
   * @returns {JiaSet}
   */
  intervalSet(name, members) {
    this.assertKind("cp", "intervalSet");
    const set = this.declareSet("Set[Interval]", name, members);
    this.domains.push({ kind: "set", set, members });
    return set;
  }

  /**
   * Declare a named set of integer variables.
   * @param {string} name Set identifier.
   * @param {JiaVar[]} members Integer variables included in the set.
   * @returns {JiaSet}
   */
  integerSet(name, members) {
    this.assertKind("cp", "integerSet");
    const set = this.declareSet("Set[Integer]", name, members);
    this.domains.push({ kind: "set", set, members });
    return set;
  }

  /**
   * Declare resource demand for an interval against an interval resource set.
   * @param {JiaVar} interval Interval consuming resource capacity.
   * @param {JiaSet} set Resource set that carries the demand.
   * @param {number} value Capacity units consumed.
   * @returns {void}
   */
  demand(interval, set, value) {
    this.assertKind("cp", "demand");
    this.domains.push({ kind: "demand", interval, set, value });
  }

  /**
   * Add a named constraint to the model.
   * @param {string} name Constraint identifier.
   * @param {JiaConstraint} expr Constraint expression created by the builder.
   * @returns {void}
   */
  constraint(name, expr) {
    this.constraints.push(new JiaConstraint("named", { name, constraint: asConstraint(expr) }));
  }

  /**
   * Add a `no_overlap` scheduling constraint.
   * @param {string} name Constraint identifier.
   * @param {JiaSet | JiaVar[]} intervalsOrSet Interval set or explicit interval variables.
   * @returns {void}
   */
  noOverlap(name, intervalsOrSet) {
    this.assertKind("cp", "noOverlap");
    const items = Array.isArray(intervalsOrSet) ? intervalsOrSet : [intervalsOrSet];
    this.constraints.push(new JiaConstraint("named", { name, constraint: new JiaConstraint("noOverlap", { items }) }));
  }

  /**
   * Add a cumulative resource-capacity constraint.
   * @param {string} name Constraint identifier.
   * @param {JiaSet} set Interval resource set to constrain.
   * @param {JiaExprInput} capacity Maximum available capacity.
   * @returns {void}
   */
  cumulative(name, set, capacity) {
    this.assertKind("cp", "cumulative");
    this.constraints.push(new JiaConstraint("named", { name, constraint: new JiaConstraint("cumulative", { set, capacity: asExpr(capacity) }) }));
  }

  /**
   * Add a span constraint tying a parent interval to a set of child intervals.
   * @param {string} name Constraint identifier.
   * @param {JiaVar} parent Parent interval.
   * @param {JiaSet} set Child interval set.
   * @returns {void}
   */
  span(name, parent, set) {
    this.assertKind("cp", "span");
    this.constraints.push(new JiaConstraint("named", { name, constraint: new JiaConstraint("span", { parent, set }) }));
  }

  /**
   * Add an alternative constraint selecting one child interval for a parent.
   * @param {string} name Constraint identifier.
   * @param {JiaVar} parent Parent interval.
   * @param {JiaSet} set Candidate child interval set.
   * @returns {void}
   */
  alternative(name, parent, set) {
    this.assertKind("cp", "alternative");
    this.constraints.push(new JiaConstraint("named", { name, constraint: new JiaConstraint("alternative", { parent, set }) }));
  }

  /**
   * Add pairwise inequality constraints across all supplied variables.
   * @param {string} name Prefix used for generated constraint identifiers.
   * @param {JiaAllDifferentInput} setOrValues Integer set or explicit integer variables.
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

  /** Set a minimization objective. @param {JiaExprInput} expr Objective expression. @returns {void} */
  minimize(expr) {
    this.objective = { direction: "minimize", expr: asExpr(expr) };
  }

  /** Set a maximization objective. @param {JiaExprInput} expr Objective expression. @returns {void} */
  maximize(expr) {
    this.objective = { direction: "maximize", expr: asExpr(expr) };
  }

  /** Clear the objective and render the model as satisfaction-only. @returns {void} */
  satisfy() {
    this.objective = null;
  }

  /** Build a left-associated sum expression. @param {...JiaExprInput} terms Terms to add. @returns {JiaExpr} */
  add(...terms) {
    return chainBinary("+", terms);
  }

  /** Build a subtraction expression. @param {JiaExprInput} left Minuend. @param {JiaExprInput} right Subtrahend. @returns {JiaExpr} */
  sub(left, right) {
    return new JiaExpr("binary", { op: "-", left: asExpr(left), right: asExpr(right) });
  }

  /** Build a left-associated product expression. @param {...JiaExprInput} terms Terms to multiply. @returns {JiaExpr} */
  mul(...terms) {
    return chainBinary("*", terms);
  }

  /** Build a numeric negation expression. @param {JiaExprInput} value Value to negate. @returns {JiaExpr} */
  neg(value) {
    return new JiaExpr("neg", { value: asExpr(value) });
  }

  /** Build a `<=` comparison constraint. @param {JiaExprInput} left Left expression. @param {JiaExprInput} right Right expression. @returns {JiaConstraint} */
  le(left, right) { return comparison("<=", left, right); }
  /** Build a `>=` comparison constraint. @param {JiaExprInput} left Left expression. @param {JiaExprInput} right Right expression. @returns {JiaConstraint} */
  ge(left, right) { return comparison(">=", left, right); }
  /** Build a `<` comparison constraint. @param {JiaExprInput} left Left expression. @param {JiaExprInput} right Right expression. @returns {JiaConstraint} */
  lt(left, right) { return comparison("<", left, right); }
  /** Build a `>` comparison constraint. @param {JiaExprInput} left Left expression. @param {JiaExprInput} right Right expression. @returns {JiaConstraint} */
  gt(left, right) { return comparison(">", left, right); }
  /** Build an equality comparison constraint. @param {JiaExprInput} left Left expression. @param {JiaExprInput} right Right expression. @returns {JiaConstraint} */
  eq(left, right) { return comparison("==", left, right); }
  /** Build an inequality comparison constraint. @param {JiaExprInput} left Left expression. @param {JiaExprInput} right Right expression. @returns {JiaConstraint} */
  ne(left, right) { return comparison("!=", left, right); }

  /** Reference an interval start time. @param {JiaVar} interval Interval variable. @returns {JiaExpr} */
  startOf(interval) { return new JiaExpr("call", { name: "start_of", args: [nameOf(interval)] }); }
  /** Reference an interval end time. @param {JiaVar} interval Interval variable. @returns {JiaExpr} */
  endOf(interval) { return new JiaExpr("call", { name: "end_of", args: [nameOf(interval)] }); }
  /** Reference an interval duration. @param {JiaVar} interval Interval variable. @returns {JiaExpr} */
  durationOf(interval) { return new JiaExpr("call", { name: "duration_of", args: [nameOf(interval)] }); }
  /** Reference whether an optional interval is present. @param {JiaVar} interval Interval variable. @returns {JiaExpr} */
  presentOf(interval) { return new JiaExpr("call", { name: "present_of", args: [nameOf(interval)] }); }

  /** Render the model to generated SDK files. @returns {FileMap} File map containing one `.jia` file. */
  toFiles() {
    return { [`${this.name}.jia`]: this.toJia() };
  }

  /** Render the model to `.jia` source. @returns {string} Jia source text. */
  toJia() {
    return renderJia(this);
  }

  /** Assert that a builder method is being used with the correct model kind. @param {JiaModelKind} kind Required model kind. @param {string} method Method name for error messages. @returns {void} */
  assertKind(kind, method) {
    if (this.kind !== kind) throw new Error(`${method}() is only available on ${kind} models`);
  }

  /** Declare a variable node and track it in the model. @param {JiaVariableKind} type Jia variable type. @param {string} name Variable identifier. @returns {JiaVar} */
  declare(type, name) {
    const variable = new JiaVar(type, assertIdentifier(name, "variable name"));
    this.variables.push({ type, value: variable });
    return variable;
  }

  /** Declare a set node and track it in the model. @param {"Set[Interval]" | "Set[Integer]"} type Jia set type. @param {string} name Set identifier. @param {JiaVar[]} members Set members. @returns {JiaSet} */
  declareSet(type, name, members) {
    const set = new JiaSet(type, assertIdentifier(name, "set name"), members);
    this.variables.push({ type, value: set });
    return set;
  }

  /** Attach a range or finite-value domain to a variable. @param {JiaVar} variable Target variable. @param {JiaDomainSpec} domain Domain specification. @returns {void} */
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
