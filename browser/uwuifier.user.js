// ==UserScript==
// @name         Uwuifier for Discord
// @namespace    https://github.com/fw9c/secret
// @version      2.2.2
// @description  turns everything u send on Discord web into cat boy speak :3
// @match        https://discord.com/*
// @match        https://ptb.discord.com/*
// @match        https://canary.discord.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * No Vencord needed: this rewrites the message right as it's sent to
 * Discord's API, so it works in any browser with a userscript extension
 * (Firefox for Android + Violentmonkey on a phone).
 *
 * Pink "fm" tab on the right edge: tap = on/off, hold 3s = settings.
 * Ctrl+Shift+U toggles on a keyboard.
 */
(() => {
    "use strict";

    // ---- settings (change them from the pink "fm" tab) -------------------------
    const DEFAULTS = {
        active: true,
        swears: "keep",   // "keep", "cute" (fuck -> frick), or "censor" (f***)
        stutter: 0,       // 0 to 1
        faces: 0.5,       // 0 to 1
        editsToo: true,   // change edited messages too
    };

    // Discord deletes window.localStorage once it loads, so grab it first.
    const LS = (() => { try { return window.localStorage; } catch { return null; } })();
    const KEY = "uwuifier-settings";
    const cfg = Object.assign({}, DEFAULTS, (() => {
        try { return JSON.parse(LS && LS.getItem(KEY)) || {}; } catch { return {}; }
    })());

    function save() {
        try { LS && LS.setItem(KEY, JSON.stringify(cfg)); } catch { }
    }

    // v2 (cat boy) switched the defaults to no stutter and swears left alone.
    if (cfg.v !== 2) {
        cfg.v = 2;
        cfg.stutter = DEFAULTS.stutter;
        cfg.swears = DEFAULTS.swears;
        save();
    }

    // ---- text engine (generated from core/engine.js, edit it there) ----
    // Cat boy speak: lowercase, a few stretched words, !! and ~, and kitty
    // sounds (mrrp, nya~, meow) where full stops used to be.
    // femify(text, { swears: "keep" | "cute" | "censor", stutter: 0..1, faces: 0..1 })

    // Stems, so "fucking", "bullshit", "motherfucker" etc. are caught too.
    const SWEARS = [
        [/fuck/g, "frick"],
        [/shit/g, "shoot"],
        [/bitch/g, "meanie"],
        [/cunt/g, "meanie"],
        [/bastard/g, "meanie"],
        [/\bdamn/g, "dang"],
        [/\bcrap/g, "crud"],
        [/\bhell\b/g, "heck"],
        [/\bdick(head)?\b/g, "meanie$1"],
        [/\b(dumb|jack|bad|smart|kick|lazy)?ass(hole|es)?\b/g, "$1butt$2"],
        [/\bpiss/g, "pee"],
        [/\bwtf\b/g, "wth"],
    ];

    // Whole-word swaps, in order (so "thank you" goes before "you").
    // Runs on lowercased text, so no /i needed.
    const WORDS = [
        // greetings
        [/\bhello+\b/g, "hewwo"],
        [/\bhi+\b/g, "hiii"],
        [/\bhe+y+\b/g, "heyyy"],
        [/\bbye+\b/g, "bai bai"],
        [/\bgood ?morning\b/g, "mowning"],
        // you / thanks / sorry / please
        [/\bthank you\b/g, "tank u"],
        [/\bthanks\b/g, "tysm"],
        [/\byou'?re\b/g, "ur"],
        [/\byour\b/g, "ur"],
        [/\byou\b/g, "u"],
        [/\bsorry\b/g, "sowwy"],
        [/\bplease\b/g, "pwease"],
        // e-girl words
        [/\blove\b/g, "wuv"],
        [/\bloves\b/g, "wuvs"],
        [/\b(?:little|small)\b/g, "smol"],
        [/\bcute\b/g, "cyute"],
        [/\bpretty\b/g, "pwetty"],
        [/\bfriends\b/g, "fwens"],
        [/\bfriend\b/g, "fwen"],
        [/\bwhatever\b/g, "watevs"],
        [/\bwhat\b/g, "wat"],
        [/\bwith\b/g, "wif"],
        [/\byes\b/g, "yesh"],
        [/\bno\b/g, "nu"],
        [/\bgood\b/g, "gud"],
        [/\bstupid\b/g, "stoopid"],
        [/\bhugs?\b/g, "huggies"],
        [/\bok(?:ay)?\b/g, "okie"],
        [/\bprobably\b/g, "prolly"],
        [/\bbecause\b/g, "bc"],
        // cat boy
        [/\b(?:tired|sleepy)\b/g, "eepy"],
        [/\bsleep(ing)?\b/g, "eep$1"],
        [/\bcats\b/g, "kitties"],
        [/\bcat\b/g, "kitty"],
        [/\bperfect\b/g, "purrfect"],
        [/\bawesome\b/g, "pawsome"],
        [/\bfor real\b/g, "fur real"],
        // stretchy
        [/\bso\b/g, "soo"],
        [/\bomg\b/g, "omgg"],
    ];

    const FACES = [":3", ":3", ":3", "mrrp", "mrrp", "nya~", "meow", "mrow~", "x3", ">w<", "=^.^="];
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    // Bits of a message that must survive untouched: code, links, mentions,
    // custom emoji, timestamps, :shortcodes:, @everyone/@here, and slang like lol/lmao.
    const PROTECTED = /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<[^<>\s]+>|:[\w~-]+:|@everyone|@here|\bl+o+(?:l+o+)*l+\b|\bl+m+f*a+o+\b|\brofl\b/gi;

    function handleSwears(text, mode) {
        if (mode === "keep") return text;
        for (const [re, cute] of SWEARS) {
            text = text.replace(re, (m, ...groups) => {
                if (mode === "censor") return m[0] + "*".repeat(m.length - 1);
                return cute.replace(/\$(\d)/g, (_, i) => typeof groups[i - 1] === "string" ? groups[i - 1] : "");
            });
        }
        return text;
    }

    function femText(text, opts) {
        let out = handleSwears(text.toLowerCase(), opts.swears);
        for (const [re, rep] of WORDS) out = out.replace(re, rep);

        if (opts.stutter > 0) {
            out = out.replace(/(^|\s)([a-z])/g, (m, pre, ch) =>
                Math.random() < opts.stutter ? `${pre}${ch}-${ch}` : m);
        }

        // a lone ! becomes !!
        out = out.replace(/(^|[^!])!(?!!)/g, "$1!!");

        // commas sometimes turn into ~
        out = out.replace(/(\w),(\s)/g, (m, ch, space) => Math.random() < opts.faces * 0.5 ? `${ch}~${space}` : m);

        // Sentence ends: full stops are dropped, and a kitty sound might go there instead.
        out = out.replace(/(\w)([.!?]+)(\s+|$)/g, (m, ch, punct, space) => {
            const end = punct === "." ? "" : punct;
            return Math.random() < opts.faces ? `${ch}${end} ${pick(FACES)}${space}` : `${ch}${end}${space}`;
        });

        return out;
    }

    function femify(content, opts) {
        let result = "";
        let last = 0;
        // exec loop instead of matchAll, older mobile JS engines lack it
        PROTECTED.lastIndex = 0;
        let match;
        while ((match = PROTECTED.exec(content)) !== null) {
            result += femText(content.slice(last, match.index), opts) + match[0];
            last = match.index + match[0].length;
        }
        result += femText(content.slice(last), opts);

        // end on a face if nothing got added and the message has words in it
        if (opts.faces > 0 && /[a-z]/i.test(result) && !FACES.some(f => result.includes(f)) && Math.random() < opts.faces) {
            result = result.trimEnd();
            if (/[a-z]$/.test(result) && Math.random() < 0.5) result += "~";
            result += " " + pick(FACES);
        }
        return result;
    }
    // ---- end text engine ----

    // ---- hook outgoing messages ---------------------------------------------
    const SEND = /\/api\/v\d+\/channels\/\d+\/messages(\?|$)/;
    const EDIT = /\/api\/v\d+\/channels\/\d+\/messages\/\d+(\?|$)/;

    function shouldRewrite(method, url) {
        if (!cfg.active) return false;
        method = String(method || "GET").toUpperCase();
        url = String(url);
        if (method === "POST" && SEND.test(url)) return true;
        if (method === "PATCH" && EDIT.test(url)) return cfg.editsToo;
        return false;
    }

    function rewriteJson(json) {
        try {
            const data = JSON.parse(json);
            if (!data || typeof data.content !== "string" || !data.content) return json;
            data.content = femify(data.content, cfg);
            return JSON.stringify(data);
        } catch {
            return json;
        }
    }

    // Plain messages are a JSON string; messages with files are FormData
    // with the JSON in a "payload_json" field.
    function rewriteBody(body) {
        if (typeof body === "string") return rewriteJson(body);
        if (typeof FormData !== "undefined" && body instanceof FormData) {
            const payload = body.get("payload_json");
            if (typeof payload === "string") body.set("payload_json", rewriteJson(payload));
        }
        return body;
    }

    const XHR = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (XHR) {
        const open = XHR.open;
        const send = XHR.send;
        XHR.open = function (method, url) {
            this.__fm = shouldRewrite.bind(null, method, url);
            return open.apply(this, arguments);
        };
        XHR.send = function (body) {
            if (this.__fm && this.__fm()) body = rewriteBody(body);
            return send.call(this, body);
        };
    }

    if (typeof window.fetch === "function") {
        const fetch = window.fetch;
        window.fetch = function (input, init) {
            const url = typeof input === "string" ? input : input && input.url;
            const method = (init && init.method) || (input && input.method);
            if (init && init.body != null && shouldRewrite(method, url)) {
                init = Object.assign({}, init, { body: rewriteBody(init.body) });
            }
            return fetch.call(this, input, init);
        };
    }

    // ---- tab + settings panel -------------------------------------------------
    const HOLD_MS = 3000; // how long to hold the tab to open settings
    let bubble = null;
    let panel = null;
    let syncPanel = () => { };

    function el(tag, style, props) {
        const e = document.createElement(tag);
        Object.assign(e.style, style || {});
        Object.assign(e, props || {});
        return e;
    }

    // Keep taps inside our UI from reaching Discord's own handlers.
    function shield(e) {
        for (const t of ["click", "mousedown", "pointerdown", "touchstart", "keydown"])
            e.addEventListener(t, ev => ev.stopPropagation());
    }

    function paint() {
        if (bubble) {
            bubble.textContent = "fm";
            bubble.style.opacity = cfg.active ? "0.9" : "0.35";
            bubble.style.textDecoration = cfg.active ? "none" : "line-through";
            bubble.title = (cfg.active ? "fm mode on" : "fm mode off") + " (tap to toggle, hold for settings)";
        }
        syncPanel();
    }

    function setActive(on) {
        cfg.active = on;
        save();
        paint();
    }

    function slider(label, key) {
        const row = el("label", { display: "block", margin: "10px 0 0" });
        const text = el("div", { marginBottom: "4px" });
        const input = el("input", { width: "100%", accentColor: "#ff73c6" }, { type: "range", min: "0", max: "1", step: "0.05" });
        const show = () => { text.textContent = `${label}: ${Math.round(cfg[key] * 100)}%`; };
        input.addEventListener("input", () => { cfg[key] = Number(input.value); show(); save(); });
        row.appendChild(text);
        row.appendChild(input);
        return { row, sync: () => { input.value = String(cfg[key]); show(); } };
    }

    function checkbox(label, key, onChange) {
        const row = el("label", { display: "flex", alignItems: "center", gap: "8px", margin: "10px 0 0" });
        const input = el("input", { width: "20px", height: "20px", accentColor: "#ff73c6" }, { type: "checkbox" });
        input.addEventListener("change", () => onChange ? onChange(input.checked) : (cfg[key] = input.checked, save()));
        row.appendChild(input);
        row.appendChild(el("span", {}, { textContent: label }));
        return { row, sync: () => { input.checked = !!cfg[key]; } };
    }

    function buildPanel() {
        panel = el("div", {
            position: "fixed", right: "44px", top: "20%", zIndex: "2147483647",
            width: "240px", maxWidth: "calc(100vw - 60px)", padding: "12px 14px",
            background: "#2b2d31", color: "#f2f3f5", font: "14px sans-serif",
            borderRadius: "12px", border: "2px solid #ff73c6", boxShadow: "0 4px 16px rgba(0,0,0,.5)",
            display: "none",
        });
        shield(panel);

        panel.appendChild(el("div", { fontWeight: "800", fontSize: "16px", color: "#ff73c6" }, { textContent: "fm mode :3" }));

        const on = checkbox("Change my messages", "active", setActive);
        const edits = checkbox("Change edits too", "editsToo");
        const stutter = slider("Stutter", "stutter");
        const faces = slider("Faces (:3, mrrp, nya~)", "faces");

        const swearRow = el("label", { display: "block", margin: "10px 0 0" });
        swearRow.appendChild(el("div", { marginBottom: "4px" }, { textContent: "Swear words" }));
        const swears = el("select", { width: "100%", padding: "4px", background: "#1e1f22", color: "#f2f3f5", border: "1px solid #555", borderRadius: "6px" });
        for (const [value, text] of [["keep", "Leave as-is"], ["cute", "Cute-ify (fuck → frick)"], ["censor", "Censor (f***)"]])
            swears.appendChild(el("option", {}, { value, textContent: text }));
        swears.addEventListener("change", () => { cfg.swears = swears.value; save(); });
        swearRow.appendChild(swears);

        const close = el("button", {
            marginTop: "12px", width: "100%", padding: "8px", border: "0", borderRadius: "8px",
            background: "#ff73c6", color: "#fff", fontWeight: "800", cursor: "pointer",
        }, { textContent: "Done", type: "button" });
        close.addEventListener("click", () => { panel.style.display = "none"; });

        for (const part of [on, edits, stutter, faces]) panel.appendChild(part.row);
        panel.appendChild(swearRow);
        panel.appendChild(close);

        syncPanel = () => {
            for (const part of [on, edits, stutter, faces]) part.sync();
            swears.value = cfg.swears;
        };
        document.body.appendChild(panel);
    }

    function addBubble() {
        if (bubble || !document.body) return;
        bubble = el("div", {
            position: "fixed", right: "0", top: "35%", zIndex: "2147483647",
            background: "#ff73c6", color: "#fff", font: "800 12px sans-serif",
            padding: "8px 6px", borderRadius: "10px 0 0 10px", cursor: "pointer",
            userSelect: "none", webkitUserSelect: "none", webkitTouchCallout: "none",
            touchAction: "none", transition: "transform .15s", boxShadow: "0 2px 6px rgba(0,0,0,.4)",
        });
        shield(bubble);

        // Tap = on/off, hold = settings.
        let timer = null;
        let held = false;
        const cancel = () => {
            clearTimeout(timer);
            timer = null;
            bubble.style.transform = "";
        };
        bubble.addEventListener("pointerdown", () => {
            held = false;
            bubble.style.transform = "scale(1.15)";
            timer = setTimeout(() => {
                held = true;
                cancel();
                panel.style.display = "block";
                paint();
            }, HOLD_MS);
        });
        for (const t of ["pointerup", "pointercancel", "pointerleave"]) bubble.addEventListener(t, cancel);
        // stop the long-press text menu / selection on phones
        bubble.addEventListener("contextmenu", e => e.preventDefault());
        bubble.addEventListener("click", e => {
            e.preventDefault();
            if (held) {
                held = false;
                return;
            }
            setActive(!cfg.active);
        });
        document.body.appendChild(bubble);
        buildPanel();
        paint();
    }

    document.addEventListener("keydown", e => {
        if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyU") {
            e.preventDefault();
            e.stopPropagation();
            setActive(!cfg.active);
        }
    }, true);

    if (document.body) addBubble();
    else document.addEventListener("DOMContentLoaded", addBubble);
})();
