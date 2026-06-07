import * as feasbl from "@feasbl/sdk";

const lp = feasbl.lp("blend");

const wheat = lp.real("wheat", { min: 0 });
const corn = lp.real("corn", { min: 0, max: 500 });
const soy = lp.real("soy", { min: 0 });

lp.minimize(
  lp.add(
    lp.mul(210, wheat),
    lp.mul(180, corn),
    lp.mul(240, soy),
  ),
);

lp.constraint("total-weight",
  lp.eq(lp.add(wheat, corn, soy), 1000),
);

lp.constraint("protein",
  lp.ge(
    lp.add(
      lp.mul(0.12, wheat),
      lp.mul(0.08, corn),
      lp.mul(0.36, soy),
    ),
    140,
  ),
);

console.log(lp.toJia());

