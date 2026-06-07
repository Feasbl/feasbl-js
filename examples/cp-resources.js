import * as feasbl from "@feasbl/sdk";

const cp = feasbl.cp("resources");

const compile = cp.interval("compile", { duration: 4 });
const link = cp.interval("link", { duration: 2 });
const test = cp.interval("test", { duration: { min: 1, max: 4 } });

const makespan = cp.integer("makespan", { min: 0, max: 20 });

const cpu = cp.intervalSet("cpu", [compile, link, test]);
const memory = cp.intervalSet("memory", [compile, test]);

cp.demand(compile, cpu, 3);
cp.demand(link, cpu, 1);
cp.demand(test, cpu, 2);
cp.demand(compile, memory, 2);
cp.demand(test, memory, 3);

cp.constraint("compile-before-link",
  cp.le(cp.endOf(compile), cp.startOf(link)),
);

cp.cumulative("cpu-capacity", cpu, 4);
cp.cumulative("memory-capacity", memory, 4);

cp.constraint("link-finished", cp.le(cp.endOf(link), makespan));
cp.constraint("test-finished", cp.le(cp.endOf(test), makespan));

cp.minimize(makespan);

console.log(cp.toJia());

