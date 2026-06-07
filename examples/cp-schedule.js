import * as feasbl from "@feasbl/sdk";

const cp = feasbl.cp("schedule");

const job1Op1 = cp.interval("job1Op1", { duration: 3 });
const job1Op2 = cp.interval("job1Op2", { duration: 2 });
const job2Op1 = cp.interval("job2Op1", { duration: 4 });
const job2Op2 = cp.interval("job2Op2", { duration: 1 });

const makespan = cp.integer("makespan", { min: 0, max: 100 });

const machine1 = cp.intervalSet("machine1", [job1Op1, job2Op2]);
const machine2 = cp.intervalSet("machine2", [job1Op2, job2Op1]);

cp.constraint("job-1-order",
  cp.le(cp.endOf(job1Op1), cp.startOf(job1Op2)),
);

cp.constraint("job-2-order",
  cp.le(cp.endOf(job2Op1), cp.startOf(job2Op2)),
);

cp.noOverlap("machine-1-capacity", machine1);
cp.noOverlap("machine-2-capacity", machine2);

cp.constraint("job-1-finished",
  cp.le(cp.endOf(job1Op2), makespan),
);

cp.constraint("job-2-finished",
  cp.le(cp.endOf(job2Op2), makespan),
);

cp.minimize(makespan);

const files = cp.toFiles();
console.log(files["schedule.jia"]);
