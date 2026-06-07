# Feasbl JavaScript SDK

[![coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Ffeasbl-cdn.t3.tigrisfiles.io%2Fcoverage%2Ffeasbl-js%2Fcoverage-badge.json&cacheSeconds=300)](https://feasbl-cdn.t3.tigrisfiles.io/coverage/feasbl-js/index.html)

`@feasbl/sdk` provides JavaScript builders for Feasbl optimization inputs:

- `.jia` models for CP and LP workflows
- PDDL domain/problem files for planning workflows
- a small direct-submit client for the Feasbl API

## Install

```bash
npm install git+ssh://git@github.com/Feasbl/feasbl-js.git
```

## Use

```js
import * as feasbl from "@feasbl/sdk";

const lp = feasbl.lp("production");

const chairs = lp.real("chairs", { min: 0 });
const tables = lp.real("tables", { min: 0 });

lp.maximize(lp.add(lp.mul(45, chairs), lp.mul(80, tables)));
lp.constraint("wood", lp.le(lp.add(lp.mul(2, chairs), lp.mul(4, tables)), 120));

console.log(lp.toJia());
```

See `examples/` for CP, LP, and planning examples.

## Test

```bash
npm test
```

## Coverage

Coverage uses Node's built-in test runner with `c8` instrumentation.

```bash
npm run coverage
```

## Smoketest

Submit a small model to the live API:

```bash
npm run smoketest -- <fsbl_api_key>
```

The target can be overridden with `FEASBL_API_BASE_URL`,
`FEASBL_COMPUTE_TIER_ID`, or `FEASBL_TIME_LIMIT_S`.
