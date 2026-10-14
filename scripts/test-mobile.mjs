// Loads mobile/uwuifier/index.js the same way Vendetta/Bunny do
// (`vendetta=>{return <file>}`) against a fake API, then checks the patches.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const dir = new URL("../mobile/uwuifier/", import.meta.url);
const js = readFileSync(new URL("index.js", dir), "utf8");
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
assert.equal(manifest.hash, createHash("sha256").update(js).digest("hex"), "manifest hash is stale, run node scripts/update-hash.mjs");

const MessageActions = { sendMessage() {}, editMessage() {}, receiveMessage() {} };
const before = (name, obj, fn) => {
    const orig = obj[name];
    obj[name] = function (...args) { fn(args); return orig.apply(this, args); };
    return () => { obj[name] = orig; };
};
const cmds = [];
const toasts = [];
const fake = {
    metro: {
        findByProps: (...p) => p.every(k => k in MessageActions) ? MessageActions : null,
        common: { React: { createElement: () => null, Fragment: "F" }, ReactNative: {} },
    },
    patcher: { before },
    commands: { registerCommand: c => { cmds.push(c); return () => cmds.splice(cmds.indexOf(c), 1); } },
    storage: { useProxy() {} },
    ui: { toasts: { showToast: t => toasts.push(t) }, assets: { getAssetIDByName: () => 1 } },
    plugin: { storage: {} },
};

const raw = (0, eval)(`vendetta=>{return ${js}}`)(fake);
const p = raw?.default ?? raw;
assert.equal(typeof p.onLoad, "function", "eval returned no plugin object (ASI?)");
p.onLoad();
assert.deepEqual(cmds.map(c => c.name).sort(), ["fm", "fmtoggle"]);

const store = fake.plugin.storage;
store.stutter = 0; store.faces = 0;
Math.random = () => 0.99; // full stops get dropped rather than turned into ~

const send = c => { const m = { content: c }; MessageActions.sendMessage("1", m); return m.content; };
assert.equal(send("Hello there, I really love this game!"), "hiii there, i really luv this game!");
assert.equal(send("Fuck this https://example.com/Really <@123> :Heart: lol"), "frick this https://example.com/Really <@123> :Heart: lol");
assert.equal(send("`Real Code` stays"), "`Real Code` stays");
assert.equal(send("Thank you, I am tired. Goodnight friends"), "tysm, i am eepy nini besties");

const edit = c => { const m = { content: c }; MessageActions.editMessage("1", "2", m); return m.content; };
assert.equal(edit("Hello"), "hiii");
store.editsToo = false;
assert.equal(edit("Hello"), "Hello");

cmds.find(c => c.name === "fmtoggle").execute([], {});
assert.equal(store.active, false);
assert.equal(send("Hello"), "Hello");

// /fm works while off, and is not changed twice when on
const out = cmds.find(c => c.name === "fm").execute([{ name: "text", value: "Hello", type: 3 }], {});
assert.equal(out.content, "hiii");
store.active = true;
const out2 = cmds.find(c => c.name === "fm").execute([{ name: "text", value: "I love you", type: 3 }], {});
assert.equal(send(out2.content), "i luv u");

store.swears = "censor";
assert.equal(send("shit"), "s***");

p.onUnload();
assert.equal(cmds.length, 0);
assert.equal(send("Hello"), "Hello", "patches not removed");
console.log("all mobile plugin checks passed");
