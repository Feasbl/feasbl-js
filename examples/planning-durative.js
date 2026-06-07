import * as feasbl from "@feasbl/sdk";

const plan = feasbl.planning("courier");

const location = plan.type("location");
const vehicle = plan.type("vehicle");

const at = plan.predicate("at", [vehicle, location]);
const road = plan.predicate("road", [location, location]);
const battery = plan.numeric("battery", [vehicle]);
const distance = plan.numeric("distance", [location, location]);

plan.durativeAction("drive", action => {
  const truck = action.param("truck", vehicle);
  const start = action.param("start", location);
  const end = action.param("end", location);

  return {
    duration: plan.eq(action.duration(), distance(start, end)),
    conditions: {
      start: plan.and(
        at(truck, start),
        road(start, end),
        plan.ge(battery(truck), distance(start, end)),
      ),
      overAll: road(start, end),
    },
    effects: {
      start: plan.not(at(truck, start)),
      end: plan.and(
        at(truck, end),
        plan.decrease(battery(truck), distance(start, end)),
      ),
    },
  };
});

const van = plan.object("van", vehicle);
const depot = plan.object("depot", location);
const customer = plan.object("customer", location);

plan.initially(
  at(van, depot),
  road(depot, customer),
  plan.assign(battery(van), 100),
  plan.assign(distance(depot, customer), 10),
);

plan.goal(at(van, customer));

const files = plan.toFiles();
console.log(files["domain.pddl"]);
console.log(files["problem.pddl"]);
