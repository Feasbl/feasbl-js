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
  /** @param {string} name */
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

  /** @param {string} name @returns {PddlType} */
  type(name) {
    const type = new PddlType(name);
    this.types.push(type);
    return type;
  }

  /**
   * Declare a PDDL predicate and return a callable expression builder.
   * @param {string} name
   * @param {PddlType[]} types
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
   * @param {string} name
   * @param {PddlType[]} types
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

  /** @param {string} name @param {(scope: ActionScope) => ActionBody} build @returns {void} */
  action(name, build) {
    const scope = new ActionScope();
    const body = build(scope);
    assertUniqueParams(scope.params);
    this.actions.push({ kind: "action", name: assertName(name, "action name"), params: scope.params, body });
  }

  /** @param {string} name @param {(scope: ActionScope) => DurativeActionBody} build @returns {void} */
  durativeAction(name, build) {
    const scope = new ActionScope();
    const body = build(scope);
    assertUniqueParams(scope.params);
    this.actions.push({ kind: "durative", name: assertName(name, "durative action name"), params: scope.params, body });
  }

  /** @param {string} name @param {PddlType} type @returns {PddlObject} */
  object(name, type) {
    const object = new PddlObject(name, type);
    this.objects.push(object);
    return object;
  }

  /** @param {...PddlExpr} facts @returns {void} */
  initially(...facts) {
    this.init.push(...facts);
  }

  /** @param {PddlExpr} expr @returns {void} */
  goal(expr) {
    this.goalExpr = expr;
  }

  /** @param {...PddlExpr} items @returns {PddlExpr} */
  and(...items) { return new PddlExpr("and", { items: flatten("and", items) }); }
  /** @param {...PddlExpr} items @returns {PddlExpr} */
  or(...items) { return new PddlExpr("or", { items: flatten("or", items) }); }
  /** @param {PddlExpr} expr @returns {PddlExpr} */
  not(expr) { return new PddlExpr("not", { expr }); }
  /** @param {PddlValue} left @param {PddlValue} right @returns {PddlExpr} */
  eq(left, right) { return new PddlExpr("comparison", { op: "=", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** @param {PddlValue} left @param {PddlValue} right @returns {PddlExpr} */
  ge(left, right) { return new PddlExpr("comparison", { op: ">=", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** @param {PddlValue} left @param {PddlValue} right @returns {PddlExpr} */
  le(left, right) { return new PddlExpr("comparison", { op: "<=", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** @param {PddlValue} left @param {PddlValue} right @returns {PddlExpr} */
  gt(left, right) { return new PddlExpr("comparison", { op: ">", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** @param {PddlValue} left @param {PddlValue} right @returns {PddlExpr} */
  lt(left, right) { return new PddlExpr("comparison", { op: "<", left: asPddlValue(left), right: asPddlValue(right) }); }
  /** @param {PddlExpr} target @param {PddlValue} value @returns {PddlExpr} */
  assign(target, value) { return new PddlExpr("numericEffect", { op: "assign", target, value: asPddlValue(value) }); }
  /** @param {PddlExpr} target @param {PddlValue} value @returns {PddlExpr} */
  increase(target, value) { return new PddlExpr("numericEffect", { op: "increase", target, value: asPddlValue(value) }); }
  /** @param {PddlExpr} target @param {PddlValue} value @returns {PddlExpr} */
  decrease(target, value) { return new PddlExpr("numericEffect", { op: "decrease", target, value: asPddlValue(value) }); }
  /** @returns {PddlExpr} */
  duration() { return new PddlExpr("duration", {}); }

  /** @returns {FileMap} */
  toFiles() {
    return { "domain.pddl": this.toDomainPddl(), "problem.pddl": this.toProblemPddl() };
  }

  /** @returns {string} */
  toPddl() {
    const files = this.toFiles();
    return `${files["domain.pddl"]}\n${files["problem.pddl"]}`;
  }

  /** @returns {string} */
  toDomainPddl() { return renderDomainPddl(this); }
  /** @returns {string} */
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
