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
  /** @param {string} name */
  constructor(name) {
    /** @type {string} */
    this.name = assertName(name, "type name");
  }
}

export class PddlParam {
  /** @param {string} name @param {PddlType} type */
  constructor(name, type) {
    /** @type {string} */
    this.name = assertName(name, "parameter name");
    /** @type {PddlType} */
    this.type = type;
  }
}

export class PddlObject {
  /** @param {string} name @param {PddlType} type */
  constructor(name, type) {
    /** @type {string} */
    this.name = assertName(name, "object name");
    /** @type {PddlType} */
    this.type = type;
  }
}

export class PddlPredicate {
  /** @param {string} name @param {PddlType[]} types */
  constructor(name, types) {
    /** @type {string} */
    this.name = assertName(name, "predicate name");
    /** @type {PddlType[]} */
    this.types = types;
  }

  /** @param {PddlValue[]} args @returns {PddlExpr} */
  call(args) {
    assertArity(this.name, this.types, args);
    return new PddlExpr("predicate", { name: this.name, args });
  }
}

export class PddlFunction {
  /** @param {string} name @param {PddlType[]} types */
  constructor(name, types) {
    /** @type {string} */
    this.name = assertName(name, "numeric fluent name");
    /** @type {PddlType[]} */
    this.types = types;
  }

  /** @param {PddlValue[]} args @returns {PddlExpr} */
  call(args) {
    assertArity(this.name, this.types, args);
    return new PddlExpr("function", { name: this.name, args });
  }
}

export class PddlExpr {
  /** @param {PddlExprNode["kind"]} kind @param {Omit<PddlExprNode, "kind">} props */
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
  constructor() {
    /** @type {PddlParam[]} */
    this.params = [];
  }

  /** @param {string} name @param {PddlType} type @returns {PddlParam} */
  param(name, type) {
    const param = new PddlParam(name, type);
    this.params.push(param);
    return param;
  }

  /** @returns {PddlExpr} */
  duration() {
    return new PddlExpr("duration", {});
  }
}

/** @param {string} value @param {string} label @returns {string} */
export function assertName(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

/** @param {string} name @param {unknown[]} types @param {unknown[]} args @returns {void} */
export function assertArity(name, types, args) {
  if (args.length !== types.length) {
    throw new Error(`${name} expects ${types.length} argument(s), got ${args.length}`);
  }
}

/** @param {PddlParam[]} params @returns {void} */
export function assertUniqueParams(params) {
  const names = new Set();
  for (const param of params) {
    if (names.has(param.name)) throw new Error(`Duplicate action parameter: ${param.name}`);
    names.add(param.name);
  }
}
