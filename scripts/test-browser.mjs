// Runs browser/uwuifier.user.js against fake XHR/fetch/DOM and checks it
// rewrites outgoing Discord messages and leaves everything else alone.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../browser/uwuifier.user.js", import.meta.url), "utf8");

const sent = [];
class FakeXHR {
    open(method, url) { this.m = method; this.u = url; }
    send(body) { sent.push({ via: "xhr", m: this.m, u: this.u, body }); }
}
const fetched = [];
const store = new Map();
const listeners = {};
const body = { appendChild() {} };

const window = {
    XMLHttpRequest: FakeXHR,
    fetch: async (input, init) => { fetched.push({ input, init }); return {}; },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
};
const document = {
    body: null,
    createElement: () => { throw new Error("no DOM in this test"); },
    addEventListener: (t, f) => { listeners[t] = f; },
};
new Function("window", "document", "XMLHttpRequest", src)(window, document, FakeXHR);

const origRandom = Math.random;
Math.random = () => 0.99; // no stutter, no faces: deterministic

const xhr = (m, u, b) => { const x = new window.XMLHttpRequest(); x.open(m, u); x.send(b); return sent.at(-1).body; };
const API = "https://discord.com/api/v9/channels/123";

assert.equal(JSON.parse(xhr("POST", `${API}/messages`, JSON.stringify({ content: "hello really <@1> https://x.com/lol", nonce: "1" }))).content,
    "hewwo weawwy <@1> https://x.com/lol");
assert.equal(JSON.parse(xhr("PATCH", `${API}/messages/456`, JSON.stringify({ content: "really" }))).content, "weawwy");
// other requests untouched
assert.equal(xhr("POST", `${API}/typing`, '{"content":"really"}'), '{"content":"really"}');
assert.equal(xhr("GET", `${API}/messages`, undefined), undefined);
assert.equal(xhr("POST", "https://discord.com/api/v9/interactions", '{"content":"really"}'), '{"content":"really"}');
// attachments: FormData payload_json
const fd = new FormData();
fd.set("payload_json", JSON.stringify({ content: "really" }));
assert.equal(JSON.parse(xhr("POST", `${API}/messages`, fd).get("payload_json")).content, "weawwy");
// fetch path
await window.fetch(`${API}/messages`, { method: "POST", body: '{"content":"really"}' });
assert.equal(JSON.parse(fetched.at(-1).init.body).content, "weawwy");

// Ctrl+Shift+U toggles and the setting persists
const ctrlShiftU = { ctrlKey: true, shiftKey: true, altKey: false, code: "KeyU", preventDefault() {}, stopPropagation() {} };
listeners.keydown(ctrlShiftU);
assert.equal(JSON.parse(store.get("uwuifier-settings")).active, false);
assert.equal(JSON.parse(xhr("POST", `${API}/messages`, '{"content":"really"}')).content, "really");
listeners.keydown(ctrlShiftU);
assert.equal(JSON.parse(xhr("POST", `${API}/messages`, '{"content":"really"}')).content, "weawwy");

Math.random = origRandom;
console.log("all browser userscript checks passed");
