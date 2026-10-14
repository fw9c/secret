// Copies core/engine.js into every version of the plugin, between the
// "text engine" marker comments, so the text rules live in one place.
// Run after editing core/engine.js:  node scripts/sync-engine.mjs
// (then node scripts/update-hash.mjs for the Kettu version)
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const engine = readFileSync(new URL("core/engine.js", root), "utf8").trimEnd();
const TARGETS = ["desktop/uwuifier/index.tsx", "mobile/uwuifier/index.js", "browser/uwuifier.user.js"];
const START = /^([ \t]*)\/\/ ---- text engine \(generated from core\/engine\.js.*$/m;
const END = /^[ \t]*\/\/ ---- end text engine ----$/m;

for (const path of TARGETS) {
    const url = new URL(path, root);
    const src = readFileSync(url, "utf8");
    const start = START.exec(src);
    const end = END.exec(src);
    if (!start || !end || end.index < start.index) throw new Error(`${path}: text engine markers missing`);
    const indent = start[1];
    const body = engine.split("\n").map(l => l ? indent + l : l).join("\n");
    const startLine = start.index + start[0].length;
    writeFileSync(url, src.slice(0, startLine) + "\n" + body + "\n" + src.slice(end.index));
    console.log("synced", path);
}
