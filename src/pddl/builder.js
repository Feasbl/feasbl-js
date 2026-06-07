// @ts-check

import { ActionScope, assertName, assertUniqueParams, PddlExpr, PddlFunction, PddlObject, PddlPredicate, PddlType } from "./ast.js";
import { renderDomainPddl, renderProblemPddl } from "./render.js";

/** @typedef {import("./ast.js").PddlValue} PddlValue */
/** @typedef {import("./ast.js").FileMap} FileMap */
/** @typedef {import("./ast.js").PddlCallable} PddlCallable */
/** @typedef {import("./ast.js").PddlActionNode} PddlActionNode */
/** @typedef {import("./ast.js").ActionBody} ActionBody */
/** @typedef {import("./ast.js").DurativeActionBody} DurativeActionBody */

export class PlanningBuilder {
  /** Create a PDDL planning builder. @param {string} name Domain and problem base name. */
  constructor(name) {
    /** @type {string} */
    this.name = assertName(name, "planning name");
    /** @type {PddlType[]} */
    this.types = [];
    /** @type {PddlCallable[]} */
    this.predicates = [];
    /** @type {PddlCallable[]} */
    this.functions = [];
    /** @type {PddlActionNode[]} */
    this.actions = [];
    /** @type {PddlObject[]} */
    this.objects = [];
    /** @type {PddlExpr[]} */
    this.init = [];
    /** @type {PddlExpr | null} */
    this.goalExpr = null;
  }

  /** Declare a PDDL object type. @param {string} name Type name. @returns {PddlType} */
  type(name) {
    const type = new PddlType(name);
    this.types.push(type);
    return type;
  }

  /**
   * Declare a PDDL predicate and return a callable expression builder.
   * @param {string} name Predicate name.
   * @param {PddlType[]} types Argument types, in order.
   * @returns {PddlCallable}
   */
  predicate(name, types) {
    const predicate = new PddlPredicate(name, types);
    /** @type {PddlCallable} */
    const callable = Object.assign(
      /** @param {...PddlValue} args */
      (...args) => predicate.call(args),
      { pddlName: predicate.name, pddlTypes: predicate.types },
    );
    this.predicates.push(callable);
    return callable;
  }

  /**
   * Declare a numeric fluent and return a callable numeric expression builder.
   * @param {string} name Numeric fluent name.
   * @param {PddlType[]} types Argument types, in order.
   * @returns {PddlCallable}
   */
  numeric(name, types) {
    const fn = new PddlFunction(name, types);
    /** @type {PddlCallable} */
    const callable = Object.assign(
      /** @param {...PddlValue} args */
      (...args) => fn.call(args),
      { pddlName: fn.name, pddlTypes: fn.types },
    );
    this.functions.push(callable);
    return callable;
  }

  /** Add an instantaneous PDDL action. @param {string} name Action name. @param {(scope: ActionScope) => ActionBody} build Callback that declares parameters and returns preconditions/effects. @returns {void} */
  action(name, build) {
    const scope = new ActionScope();
    const body = build(scope);
    assertUniqueParams(scope.params);
    this.actions.push({ kind: "action", name: assertName(name, "action name"), params: scope.params, body });
  }

  /** Add a durative PDDL action. @param {string} name Action name. @param {(scope: ActionScope) => DurativeActionBody} build Callback that declares parameters and returns duration, conditions, and effects. @returns {void} */
  durativeAction(name, build) {
    const scope = new ActionScope();
    const body = build(scope);
    assertUniqueParams(scope.params);
    this.actions.push({ kind: "durative", name: assertName(name, "durative action name"), params: scope.params, body });
  }

  /** Declare a problem object. @param {string} name Object name. @param {PddlType} type Object type. @returns {PddlObject} */
  object(name, type) {
    const object = new PddlObject(name, type);
    this.objects.push(object);
    return object;
  }

  /** Add facts or numeric assignments to the problem initial state. @param {...PddlExpr} facts Initial facts/effects. @returns {void} */
  initially(...facts) {
    this.init.push(...facts);
  }

  /** Set the problem goal condition. @param {PddlExpr} expr Goal expression. @returns {void} */
  goal(expr) {
    this.goalExpr = expr;
  }

  /** Build a conjunction, flattening nested conjunctions. @param {...PddlExpr} items Child expressions. @returns {PddlExpr} */
  and(...items) { return new PddlExpr("and", { items: flatten("and", items) }); }
  /** Build a disjunction, flattening nested disjunctions. @param {...PddlExpr} items Child expressions. @returns {PddlExpr} */
  or(...items) { return new PddlExpr("or", { items: flatten("or", items) }); }
  /** Build a negated condition. @param {PddlExpr} expr Expression to negate. @returns {PddlExpr} */
  not(expr) { return new PddlExpr("not", { expr }); }
  /** Build an equality comparison. @param {PddlValue} left Left value. @param {PddlValue} right Right value. @returns {PddlExpr} */
  eq(left, right) { return new PddlExpr("comparison", { op: "=", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** Build a `>=` numeric comparison. @param {PddlValue} left Left value. @param {PddlValue} right Right value. @returns {PddlExpr} */
  ge(left, right) { return new PddlExpr("comparison", { op: ">=", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** Build a `<=` numeric comparison. @param {PddlValue} left Left value. @param {PddlValue} right Right value. @returns {PddlExpr} */
  le(left, right) { return new PddlExpr("comparison", { op: "<=", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** Build a `>` numeric comparison. @param {PddlValue} left Left value. @param {PddlValue} right Right value. @returns {PddlExpr} */
  gt(left, right) { return new PddlExpr("comparison", { op: ">", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** Build a `<` numeric comparison. @param {PddlValue} left Left value. @param {PddlValue} right Right value. @returns {PddlExpr} */
  lt(left, right) { return new PddlExpr("comparison", { op: "<", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** Build a numeric assignment effect. @param {PddlExpr} target Numeric fluent expression. @param {PddlValue} value Assigned value. @returns {PddlExpr} */
  assign(target, value) { return new PddlExpr("numericEffect", { op: "assign", target, value: asPddlValue(value) }); }
  /** Build a numeric increase effect. @param {PddlExpr} target Numeric fluent expression. @param {PddlValue} value Increment value. @returns {PddlExpr} */
  increase(target, value) { return new PddlExpr("numericEffect", { op: "increase", target, value: asPddlValue(value) }); }
  /** Build a numeric decrease effect. @param {PddlExpr} target Numeric fluent expression. @param {PddlValue} value Decrement value. @returns {PddlExpr} */
  decrease(target, value) { return new PddlExpr("numericEffect", { op: "decrease", target, value: asPddlValue(value) }); }
  /** Reference the `?duration` variable inside a durative action. @returns {PddlExpr} */
  duration() { return new PddlExpr("duration", {}); }

  /** Render domain and problem PDDL files. @returns {FileMap} File map containing `domain.pddl` and `problem.pddl`. */
  toFiles() {
    return { "domain.pddl": this.toDomainPddl(), "problem.pddl": this.toProblemPddl() };
  }

  /** Render domain and problem PDDL concatenated into one string. @returns {string} PDDL source text. */
  toPddl() {
    const files = this.toFiles();
    return `${files["domain.pddl"]}\n${files["problem.pddl"]}`;
  }

  /** Render only the PDDL domain file. @returns {string} Domain PDDL source. */
  toDomainPddl() { return renderDomainPddl(this); }
  /** Render only the PDDL problem file. @returns {string} Problem PDDL source. */
  toProblemPddl() { return renderProblemPddl(this); }
}

/** @param {PddlValue} value @returns {PddlValue} */
function asPddlValue(value) {
  if (value instanceof PddlExpr || value instanceof PddlObject || typeof value === "number" || "type" in Object(value)) return value;
  throw new Error(`Expected PDDL value, got ${String(value)}`);
}

/** @param {"and" | "or"} kind @param {PddlExpr[]} items @returns {PddlExpr[]} */
function flatten(kind, items) {
  return items.flatMap(item => item.kind === kind ? requireItems(item) : [item]);
}

/** @param {PddlExpr} expr @returns {PddlExpr[]} */
function requireItems(expr) {
  if (!expr.items) throw new Error(`Expected ${expr.kind} expression to contain items`);
  return expr.items;
}
