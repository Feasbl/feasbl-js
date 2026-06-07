# JavaScript SDK Notes

The JavaScript SDK exposes executable builders for Jia and PDDL files, plus a minimal direct-submit client for API integrations.

Prefer small, explicit builder functions over dependencies or hidden client behavior. Builders must keep `toFiles()`/`toJia()`/`toPddl()` inspection available before dispatching jobs to the API.

Direct SDK job submission posts generated files to `POST /api/v1/jobs`; it must not create or require a Feasbl project.

Use `npm run smoketest -- <fsbl_api_key>` to submit a tiny LP model against the live API. Override the target with `FEASBL_API_BASE_URL`, `FEASBL_COMPUTE_TIER_ID`, or `FEASBL_TIME_LIMIT_S`.
