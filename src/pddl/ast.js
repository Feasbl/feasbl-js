// @ts-check

/**
 * @typedef {{ [path: string]: string }} FileMap
 * @typedef {PddlExpr | PddlParam | PddlObject | number} PddlValue
 * @typedef {{ kind: "predicate", name: string, args: PddlValue[] }} PddlPredicateExpr
 * @typedef {{ kind: "function", name: string, args: PddlValue[] }} PddlFunctionExpr
 * @typedef {{ kind: "duration" }} PddlDurationExpr
 * @typedef {{ kind: "and", items: PddlExpr[] }} PddlAndExpr
 * @typedef {{ kind: "or", items: PddlExpr[] }} PddlOrExpr
 * @typedef {{ kind: "not", expr: PddlExpr }} PddlNotExpr
 * @typedef {{ kind: "comparison", op: "=" | ">=" | "<=" | ">" | "<", left: PddlValue, right: PddlValue }} PddlComparisonExpr
 * @typedef {{ kind: "numericEffect", op: "assign" | "increase" | "decrease", target: PddlExpr, value: PddlValue }} PddlNumericEffectExpr
 * @typedef {{ kind: "temporal", label: "at start" | "over all" | "at end", expr: PddlExpr }} PddlTemporalExpr
 * @typedef {PddlPredicateExpr | PddlFunctionExpr | PddlDurationExpr | PddlAndExpr | PddlOrExpr | PddlNotExpr | PddlComparisonExpr | PddlNumericEffectExpr | PddlTemporalExpr} PddlExprNode
 * @typedef {((...args: PddlValue[]) => PddlExpr) & { pddlName: string, pddlTypes: PddlType[] }} PddlCallable
 * @typedef {(scope: ActionScope) => ActionBody} ActionBuilder
 * @typedef {{ preconditions?: PddlExpr, effects?: PddlExpr }} ActionBody
 * @typedef {{ duration: PddlExpr, conditions?: TemporalBlock, effects?: TemporalBlock }} DurativeActionBody
 * @typedef {{ start?: PddlExpr, overAll?: PddlExpr, end?: PddlExpr }} TemporalBlock
 * @typedef {{ kind: "action", name: string, params: PddlParam[], body: ActionBody }} PddlAction
 * @typedef {{ kind: "durative", name: string, params: PddlParam[], body: DurativeActionBody }} PddlDurativeAction
 * @typedef {PddlAction | PddlDurativeAction} PddlActionNode
 */

export class PddlType {
  /** Create a PDDL type reference. @param {string} name Type name. */
  constructor(name) {
    /** @type {string} */
    this.name = assertName(name, "type name");
  }
}

export class PddlParam {
  /** Create an action parameter. @param {string} name Parameter name without `?`. @param {PddlType} type Parameter type. */
  constructor(name, type) {
    /** @type {string} */
    this.name = assertName(name, "parameter name");
    /** @type {PddlType} */
    this.type = type;
  }
}

export class PddlObject {
  /** Create a problem object. @param {string} name Object name. @param {PddlType} type Object type. */
  constructor(name, type) {
    /** @type {string} */
    this.name = assertName(name, "object name");
    /** @type {PddlType} */
    this.type = type;
  }
}

export class PddlPredicate {
  /** Create a predicate schema. @param {string} name Predicate name. @param {PddlType[]} types Argument types. */
  constructor(name, types) {
    /** @type {string} */
    this.name = assertName(name, "predicate name");
    /** @type {PddlType[]} */
    this.types = types;
  }

  /** Instantiate this predicate with concrete terms. @param {PddlValue[]} args Predicate arguments. @returns {PddlExpr} */
  call(args) {
    assertArity(this.name, this.types, args);
    return new PddlExpr("predicate", { name: this.name, args });
  }
}

export class PddlFunction {
  /** Create a numeric fluent schema. @param {string} name Fluent name. @param {PddlType[]} types Argument types. */
  constructor(name, types) {
    /** @type {string} */
    this.name = assertName(name, "numeric fluent name");
    /** @type {PddlType[]} */
    this.types = types;
  }

  /** Instantiate this numeric fluent with concrete terms. @param {PddlValue[]} args Fluent arguments. @returns {PddlExpr} */
  call(args) {
    assertArity(this.name, this.types, args);
    return new PddlExpr("function", { name: this.name, args });
  }
}

export class PddlExpr {
  /** Create a typed PDDL expression node. @param {PddlExprNode["kind"]} kind Expression kind. @param {Omit<PddlExprNode, "kind">} props Expression fields for the kind. */
  constructor(kind, props) {
    /** @type {PddlExprNode["kind"]} */
    this.kind = kind;
    /** @type {string | undefined} */
    this.name = undefined;
    /** @type {PddlValue[] | undefined} */
    this.args = undefined;
    /** @type {PddlExpr[] | undefined} */
    this.items = undefined;
    /** @type {PddlExpr | undefined} */
    this.expr = undefined;
    /** @type {"=" | ">=" | "<=" | ">" | "<" | "assign" | "increase" | "decrease" | undefined} */
    this.op = undefined;
    /** @type {PddlValue | undefined} */
    this.left = undefined;
    /** @type {PddlValue | undefined} */
    this.right = undefined;
    /** @type {PddlExpr | undefined} */
    this.target = undefined;
    /** @type {PddlValue | undefined} */
    this.value = undefined;
    /** @type {"at start" | "over all" | "at end" | undefined} */
    this.label = undefined;
    Object.assign(this, props);
  }
}

export class ActionScope {
  /** Create the parameter declaration scope passed to action builder callbacks. */
  constructor() {
    /** @type {PddlParam[]} */
    this.params = [];
  }

  /** Declare an action parameter. @param {string} name Parameter name without `?`. @param {PddlType} type Parameter type. @returns {PddlParam} */
  param(name, type) {
    const param = new PddlParam(name, type);
    this.params.push(param);
    return param;
  }

  /** Reference the `?duration` variable for a durative action. @returns {PddlExpr} */
  duration() {
    return new PddlExpr("duration", {});
  }
}

/** Validate and return a PDDL-compatible name. @param {string} value Candidate name. @param {string} label Human-readable label for errors. @returns {string} */
export function assertName(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

/** Assert a callable received the expected number of arguments. @param {string} name Callable name. @param {unknown[]} types Declared argument types. @param {unknown[]} args Supplied arguments. @returns {void} */
export function assertArity(name, types, args) {
  if (args.length !== types.length) {
    throw new Error(`${name} expects ${types.length} argument(s), got ${args.length}`);
  }
}

/** Assert an action parameter list has no duplicate names. @param {PddlParam[]} params Parameters to inspect. @returns {void} */
export function assertUniqueParams(params) {
  const names = new Set();
  for (const param of params) {
    if (names.has(param.name)) throw new Error(`Duplicate action parameter: ${param.name}`);
    names.add(param.name);
  }
}
