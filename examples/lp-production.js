import * as feasbl from "@feasbl/sdk";

const lp = feasbl.lp("production");

const chairs = lp.real("chairs", { min: 0 });
const tables = lp.real("tables", { min: 0 });

lp.maximize(
  lp.add(
    lp.mul(45, chairs),
    lp.mul(80, tables),
  ),
);

lp.constraint("wood",
  lp.le(
    lp.add(
      lp.mul(2, chairs),
      lp.mul(4, tables),
    ),
    120,
  ),
);

lp.constraint("labor",
  lp.le(
    lp.add(
      lp.mul(3, chairs),
      lp.mul(2, tables),
    ),
    90,
  ),
);

const files = lp.toFiles();
console.log(files["production.jia"]);
