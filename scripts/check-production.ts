import "dotenv/config";
import { summarizeProductionChecks, validateProductionEnv } from "../src/lib/env/production-check";

const labelBySeverity = {
  ok: "OK",
  warning: "WARN",
  error: "ERROR",
} as const;

const results = validateProductionEnv(process.env);

for (const result of results) {
  console.log(`${labelBySeverity[result.severity]} ${result.name}: ${result.message}`);
}

const summary = summarizeProductionChecks(results);

console.log(
  `Production check summary: ${summary.ok} ok, ${summary.warnings} warnings, ${summary.errors} errors.`,
);

process.exitCode = summary.errors > 0 ? 1 : 0;
