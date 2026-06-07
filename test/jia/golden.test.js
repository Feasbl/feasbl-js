// @ts-check

import test from "node:test";

import * as feasbl from "../../src/index.js";
import { assertGolden } from "../helpers.js";

test("LP production model renders stable Jia", async () => {
  const lp = feasbl.lp("production");

  const chairs = lp.real("chairs", { min: 0 });
  const tables = lp.real("tables", { min: 0 });

  lp.maximize(lp.add(lp.mul(45, chairs), lp.mul(80, tables)));
  lp.constraint("wood", lp.le(lp.add(lp.mul(2, chairs), lp.mul(4, tables)), 120));
  lp.constraint("labor", lp.le(lp.add(lp.mul(3, chairs), lp.mul(2, tables)), 90));

  const jia = lp.toFiles()["production.jia"];
  await assertGolden("lp-production.jia", jia);
});

test("CP schedule model renders stable Jia", async () => {
  const cp = feasbl.cp("schedule");

  const job1Op1 = cp.interval("job1Op1", { duration: 3 });
  const job1Op2 = cp.interval("job1Op2", { duration: 2 });
  const job2Op1 = cp.interval("job2Op1", { duration: 4 });
  const job2Op2 = cp.interval("job2Op2", { duration: 1 });
  const makespan = cp.integer("makespan", { min: 0, max: 100 });

  const machine1 = cp.intervalSet("machine1", [job1Op1, job2Op2]);
  const machine2 = cp.intervalSet("machine2", [job1Op2, job2Op1]);

  cp.constraint("job-1-order", cp.le(cp.endOf(job1Op1), cp.startOf(job1Op2)));
  cp.constraint("job-2-order", cp.le(cp.endOf(job2Op1), cp.startOf(job2Op2)));
  cp.noOverlap("machine-1-capacity", machine1);
  cp.noOverlap("machine-2-capacity", machine2);
  cp.constraint("job-1-finished", cp.le(cp.endOf(job1Op2), makespan));
  cp.constraint("job-2-finished", cp.le(cp.endOf(job2Op2), makespan));
  cp.minimize(makespan);

  const jia = cp.toFiles()["schedule.jia"];
  await assertGolden("cp-schedule.jia", jia);
});
