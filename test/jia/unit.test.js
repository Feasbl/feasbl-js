import assert from "node:assert/strict";
import test from "node:test";

import * as feasbl from "../../src/index.js";

test("Jia expression helpers render arithmetic with grouping", () => {
  const lp = feasbl.lp("exprs");
  const x = lp.real("x", { min: 0 });
  const y = lp.real("y", { min: 0 });

  lp.constraint("weighted", lp.le(lp.mul(2, lp.add(x, y)), 10));

  assert.match(lp.toJia(), /2 \* \(x \+ y\) <= 10/);
});

test("CP scheduling helpers render specialized constraints", () => {
  const cp = feasbl.cp("helpers");
  const parent = cp.interval("parent", { start: { min: 0, max: 5 }, end: 10, optional: true });
  const childA = cp.interval("childA", { duration: { min: 1, max: 3 } });
  const childB = cp.interval("childB", { duration: 2 });
  const tasks = cp.intervalSet("tasks", [childA, childB]);
  const capacity = cp.integer("capacity", { min: 0, max: 4 });

  cp.demand(childA, tasks, 2);
  cp.noOverlap("no-overlap-array", [childA, childB]);
  cp.cumulative("capacity-limit", tasks, capacity);
  cp.span("parent-spans-tasks", parent, tasks);
  cp.alternative("choose-child", parent, tasks);
  cp.constraint("present", cp.eq(cp.presentOf(parent), 1));
  cp.constraint("duration", cp.gt(cp.durationOf(parent), cp.neg(1)));
  cp.satisfy();

  const jia = cp.toJia();
  assert.match(jia, /optional\(parent\)/);
  assert.match(jia, /demand\(childA, tasks\) = 2/);
  assert.match(jia, /no_overlap\(childA, childB\)/);
  assert.match(jia, /cumulative\(tasks, capacity\)/);
  assert.match(jia, /span\(parent, tasks\)/);
  assert.match(jia, /alternative\(parent, tasks\)/);
  assert.match(jia, /present_of\(parent\) == 1/);
  assert.match(jia, /duration_of\(parent\) > -1/);
});

test("allDifferent renders pairwise Jia inequalities", () => {
  const cp = feasbl.cp("assignment");
  const a = cp.integer("a", { values: [0, 1, 2] });
  const b = cp.integer("b", { values: [0, 1, 2] });
  const c = cp.integer("c", { values: [0, 1, 2] });
  const assigned = cp.integerSet("assigned", [a, b, c]);

  cp.allDifferent("assigned-once", assigned);

  const jia = cp.toJia();
  assert.match(jia, /a != b/);
  assert.match(jia, /a != c/);
  assert.match(jia, /b != c/);
});

test("Jia model names are validated before rendering", () => {
  assert.throws(() => feasbl.lp("bad-name"), /Invalid model name/);
});

test("Jia builders reject methods from the wrong model kind", () => {
  assert.throws(() => feasbl.lp("wrong").integer("x"), /integer\(\) is only available on cp models/);
  assert.throws(() => feasbl.cp("wrong").real("x"), /real\(\) is only available on lp models/);
});

test("Jia builders reject invalid expressions and empty arithmetic chains", () => {
  const lp = feasbl.lp("invalids");
  assert.throws(() => lp.add(), /Expected at least one expression/);
  assert.throws(() => lp.constraint("bad", "x"), /Expected a Jia constraint/);
  assert.throws(() => lp.minimize("x"), /Expected Jia expression/);
});
