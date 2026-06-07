// @ts-check

import assert from "node:assert/strict";
import test from "node:test";

import * as feasbl from "../../src/index.js";

test("PDDL predicates validate arity", () => {
  const plan = feasbl.planning("arity");
  const location = plan.type("location");
  const connected = plan.predicate("connected", [location, location]);
  const depot = plan.object("depot", location);

  assert.throws(() => connected(depot), /expects 2 argument/);
});

test("PDDL action params reject duplicates", () => {
  const plan = feasbl.planning("duplicates");
  const location = plan.type("location");

  assert.throws(() => {
    plan.action("move", action => {
      action.param("place", location);
      action.param("place", location);
      return {};
    });
  }, /Duplicate action parameter/);
});

test("PDDL renders instantaneous actions with default blocks", () => {
  const plan = feasbl.planning("defaults");
  const location = plan.type("location");
  const depot = plan.object("depot", location);
  const at = plan.predicate("at", [location]);

  plan.action("noop", () => ({}));
  plan.initially(at(depot));

  const pddl = plan.toPddl();
  assert.match(pddl, /:precondition\n\s+\(and\)/);
  assert.match(pddl, /:effect\n\s+\(and\)/);
  assert.match(pddl, /\(:goal\n    \(and\)/);
});

test("PDDL renders negative and disjunctive requirements", () => {
  const plan = feasbl.planning("requirements");
  const location = plan.type("location");
  const depot = plan.object("depot", location);
  const at = plan.predicate("at", [location]);
  const clear = plan.predicate("clear", [location]);

  plan.action("visit", action => {
    const place = action.param("place", location);
    return {
      preconditions: plan.or(at(place), plan.not(clear(place))),
      effects: clear(place),
    };
  });
  plan.goal(plan.not(at(depot)));

  const domain = plan.toDomainPddl();
  assert.match(domain, /:negative-preconditions/);
  assert.match(domain, /:disjunctive-preconditions/);
});

test("PDDL comparison and numeric effect helpers render operators", () => {
  const plan = feasbl.planning("numeric");
  const vehicle = plan.type("vehicle");
  const van = plan.object("van", vehicle);
  const battery = plan.numeric("battery", [vehicle]);

  plan.initially(plan.assign(battery(van), 10));
  plan.action("use", action => {
    const truck = action.param("truck", vehicle);
    return {
      preconditions: plan.and(
        plan.gt(battery(truck), 1),
        plan.lt(battery(truck), 20),
        plan.le(battery(truck), 10),
      ),
      effects: plan.and(
        plan.increase(battery(truck), 1),
        plan.decrease(battery(truck), 2),
      ),
    };
  });
  plan.goal(plan.ge(battery(van), 0));

  const pddl = plan.toPddl();
  assert.match(pddl, /\(> \(battery \?truck\) 1\)/);
  assert.match(pddl, /\(< \(battery \?truck\) 20\)/);
  assert.match(pddl, /\(<= \(battery \?truck\) 10\)/);
  assert.match(pddl, /\(increase \(battery \?truck\) 1\)/);
  assert.match(pddl, /\(decrease \(battery \?truck\) 2\)/);
});

test("PDDL builders validate values and arity", () => {
  const plan = feasbl.planning("invalids");
  assert.throws(() => plan.eq(null, 1), /Expected PDDL value/);
});

test("planning names are validated before rendering", () => {
  assert.throws(() => feasbl.planning("bad name"), /Invalid planning name/);
});
