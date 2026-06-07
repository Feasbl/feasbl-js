import * as feasbl from "@feasbl/sdk";

const plan = feasbl.planning("delivery");

const location = plan.type("location");
const parcel = plan.type("parcel");

const at = plan.predicate("at", [parcel, location]);
const connected = plan.predicate("connected", [location, location]);

plan.action("move", action => {
  const item = action.param("item", parcel);
  const from = action.param("from", location);
  const to = action.param("to", location);

  return {
    preconditions: plan.and(
      at(item, from),
      connected(from, to),
    ),
    effects: plan.and(
      at(item, to),
      plan.not(at(item, from)),
    ),
  };
});

const depotA = plan.object("depotA", location);
const depotB = plan.object("depotB", location);
const box = plan.object("box", parcel);

plan.initially(
  connected(depotA, depotB),
  connected(depotB, depotA),
  at(box, depotA),
);

plan.goal(at(box, depotB));

const files = plan.toFiles();
console.log(files["domain.pddl"]);
console.log(files["problem.pddl"]);

