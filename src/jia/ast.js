// @ts-check

/**
 * @typedef {"lp" | "cp"} JiaModelKind
 * @typedef {"Real" | "Integer" | "Interval" | "Set[Interval]" | "Set[Integer]"} JiaVariableKind
 * @typedef {"+" | "-" | "*"} JiaArithmeticOp
 * @typedef {"<=" | ">=" | "<" | ">" | "==" | "!="} JiaComparisonOp
 * @typedef {"minimize" | "maximize"} JiaObjectiveDirection
 * @typedef {{ min?: number, max?: number, values?: number[] }} JiaDomainSpec
 * @typedef {number | JiaDomainSpec} JiaIntervalDomainSpec
 * @typedef {{ duration?: JiaIntervalDomainSpec, start?: JiaIntervalDomainSpec, end?: JiaIntervalDomainSpec, optional?: boolean }} JiaIntervalOptions
 * @typedef {JiaExpr | JiaVar | number} JiaExprInput
 * @typedef {JiaSet | JiaVar[]} JiaAllDifferentInput
 * @typedef {{ [path: string]: string }} FileMap
 * @typedef {{ kind: "number", value: number }} JiaNumberExpr
 * @typedef {{ kind: "var", name: string }} JiaVarExpr
 * @typedef {{ kind: "call", name: string, args: string[] }} JiaCallExpr
 * @typedef {{ kind: "neg", value: JiaExpr }} JiaNegExpr
 * @typedef {{ kind: "binary", op: JiaArithmeticOp, left: JiaExpr, right: JiaExpr }} JiaBinaryExpr
 * @typedef {JiaNumberExpr | JiaVarExpr | JiaCallExpr | JiaNegExpr | JiaBinaryExpr} JiaExprNode
 * @typedef {{ kind: "comparison", op: JiaComparisonOp, left: JiaExpr, right: JiaExpr }} JiaComparisonConstraint
 * @typedef {{ kind: "noOverlap", items: (JiaSet | JiaVar)[] }} JiaNoOverlapConstraint
 * @typedef {{ kind: "cumulative", set: JiaSet, capacity: JiaExpr }} JiaCumulativeConstraint
 * @typedef {{ kind: "span", parent: JiaVar, set: JiaSet }} JiaSpanConstraint
 * @typedef {{ kind: "alternative", parent: JiaVar, set: JiaSet }} JiaAlternativeConstraint
 * @typedef {JiaComparisonConstraint | JiaNoOverlapConstraint | JiaCumulativeConstraint | JiaSpanConstraint | JiaAlternativeConstraint} JiaConstraintNode
 * @typedef {{ kind: "named", name: string, constraint: JiaConstraintNode }} JiaNamedConstraint
 * @typedef {{ kind: "range", variable: JiaVar, domain: JiaDomainSpec }} JiaRangeDomain
 * @typedef {{ kind: "intervalAttr", attr: "duration" | "start" | "end", vars: JiaVar[], domain: JiaIntervalDomainSpec }} JiaIntervalAttrDomain
 * @typedef {{ kind: "optional", vars: JiaVar[] }} JiaOptionalDomain
 * @typedef {{ kind: "set", set: JiaSet, members: JiaVar[] }} JiaSetDomain
 * @typedef {{ kind: "demand", interval: JiaVar, set: JiaSet, value: number }} JiaDemandDomain
 * @typedef {JiaRangeDomain | JiaIntervalAttrDomain | JiaOptionalDomain | JiaSetDomain | JiaDemandDomain} JiaDomainNode
 * @typedef {{ direction: JiaObjectiveDirection, expr: JiaExpr }} JiaObjective
 */

export class JiaVar {
  /**
   * @param {JiaVariableKind} kind
   * @param {string} name
   */
  constructor(kind, name) {
    /** @type {JiaVariableKind} */
    this.kind = kind;
    /** @type {string} */
    this.name = name;
  }
}

export class JiaSet {
  /**
   * @param {"Set[Interval]" | "Set[Integer]"} kind
   * @param {string} name
   * @param {JiaVar[]} members
   */
  constructor(kind, name, members) {
    /** @type {"Set[Interval]" | "Set[Integer]"} */
    this.kind = kind;
    /** @type {string} */
    this.name = name;
    /** @type {JiaVar[]} */
    this.members = members;
  }
}

export class JiaExpr {
  /**
   * @param {JiaExprNode["kind"]} kind
   * @param {Omit<JiaExprNode, "kind">} props
   */
  constructor(kind, props) {
    /** @type {JiaExprNode["kind"]} */
    this.kind = kind;
    /** @type {number | JiaExpr | undefined} */
    this.value = undefined;
    /** @type {string | undefined} */
    this.name = undefined;
    /** @type {string[] | undefined} */
    this.args = undefined;
    /** @type {JiaArithmeticOp | undefined} */
    this.op = undefined;
    /** @type {JiaExpr | undefined} */
    this.left = undefined;
    /** @type {JiaExpr | undefined} */
    this.right = undefined;
    Object.assign(this, props);
  }
}

export class JiaConstraint {
  /**
   * @param {(JiaConstraintNode | JiaNamedConstraint)["kind"]} kind
   * @param {Omit<JiaConstraintNode | JiaNamedConstraint, "kind">} props
   */
  constructor(kind, props) {
    /** @type {(JiaConstraintNode | JiaNamedConstraint)["kind"]} */
    this.kind = kind;
    /** @type {string | undefined} */
    this.name = undefined;
    /** @type {JiaConstraint | undefined} */
    this.constraint = undefined;
    /** @type {JiaComparisonOp | undefined} */
    this.op = undefined;
    /** @type {JiaExpr | undefined} */
    this.left = undefined;
    /** @type {JiaExpr | undefined} */
    this.right = undefined;
    /** @type {(JiaSet | JiaVar)[] | undefined} */
    this.items = undefined;
    /** @type {JiaSet | undefined} */
    this.set = undefined;
    /** @type {JiaExpr | undefined} */
    this.capacity = undefined;
    /** @type {JiaVar | undefined} */
    this.parent = undefined;
    Object.assign(this, props);
  }
}

/**
 * @param {string} value
 * @param {string} label
 * @returns {string}
 */
export function assertIdentifier(value, label) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}
