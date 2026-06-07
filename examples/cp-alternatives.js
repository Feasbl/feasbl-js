import * as feasbl from "@feasbl/sdk";

const cp = feasbl.cp("alternatives");

const operation = cp.interval("operation");
const operationOnA = cp.interval("operationOnA", { duration: 3, optional: true });
const operationOnB = cp.interval("operationOnB", { duration: 5, optional: true });

const followUp = cp.interval("followUp", { duration: 2 });
const makespan = cp.integer("makespan", { min: 0, max: 20 });

const operationChoices = cp.intervalSet("operationChoices", [operationOnA, operationOnB]);
const machineA = cp.intervalSet("machineA", [operationOnA]);
const machineB = cp.intervalSet("machineB", [operationOnB, followUp]);

cp.alternative("choose-operation-machine", operation, operationChoices);
cp.noOverlap("machine-a-capacity", machineA);
cp.noOverlap("machine-b-capacity", machineB);

cp.constraint("operation-before-follow-up",
  cp.le(cp.endOf(operation), cp.startOf(followUp)),
);

cp.constraint("operation-finished", cp.le(cp.endOf(operation), makespan));
cp.constraint("follow-up-finished", cp.le(cp.endOf(followUp), makespan));

cp.minimize(makespan);

console.log(cp.toJia());

