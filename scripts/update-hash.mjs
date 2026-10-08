// Writes the sha256 of mobile/uwuifier/index.js into its manifest.json.
// The phone mod only re-downloads index.js when this hash changes, so run
// this after every edit:  node scripts/update-hash.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../mobile/uwuifier/", import.meta.url);
const js = readFileSync(new URL("index.js", dir));
const manifestUrl = new URL("manifest.json", dir);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
manifest.hash = createHash("sha256").update(js).digest("hex");
writeFileSync(manifestUrl, JSON.stringify(manifest, null, 4) + "\n");
console.log("hash:", manifest.hash);
