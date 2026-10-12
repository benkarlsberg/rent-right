import { writeFileSync } from "node:fs";
import { renderCoverageMarkdown } from "../lib/rules/cities/coverage";

writeFileSync("docs/COVERAGE.md", renderCoverageMarkdown());
