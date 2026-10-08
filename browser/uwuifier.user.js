// ==UserScript==
// @name         Uwuifier for Discord
// @namespace    https://github.com/fw9c/secret
// @version      1.2.2
// @description  Turns evewything yuw send on Discord web into owo/uwu speak >w<
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
 * Pink "uwu" tab on the right edge: tap = on/off, hold 3s = settings.
 * Ctrl+Shift+U toggles on a keyboard.
 */
(() => {
    "use strict";

    // ---- settings (change them from the pink "uwu" tab) ------------------------
    const DEFAULTS = {
        active: true,
        swears: "cute",   // "cute" (fuck -> fwick), "keep", or "censor" (f***)
        stutter: 0.1,     // 0 to 1
        faces: 0.5,       // 0 to 1
        editsToo: true,   // uwuify edited messages too
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

    // ---- uwu rules (same as desktop/uwuifier/index.tsx) ----------------------
    // Stems, so "fucking", "bullshit", "motherfucker" etc. are caught too.
    const SWEARS = [
        [/fuck/gi, "fwick"],
        [/shit/gi, "poopy"],
        [/bitch/gi, "meanie"],
        [/cunt/gi, "meanie"],
        [/bastard/gi, "baka"],
        [/\bdamn/gi, "dang"],
        [/\bcrap/gi, "poopoo"],
        [/\bhell\b/gi, "heck"],
        [/\b()dick(head)?\b/gi, "$1peepee$2"],
        [/\b(dumb|jack|bad|smart|kick|lazy)?ass(hole|es)?\b/gi, "$1butt$2"],
        [/\bpiss/gi, "pee"],
        [/\bwtf\b/gi, "wtfwick"],
    ];

    const FACES = [":3", ":3", ">w<", "^w^", ":3", ":3", "(・`ω´・)", ":3", "x3", "nyaa~", "rawr x3", "(˘ω˘)", "ʘwʘ", "( ᵘ ꒳ ᵘ ✼)"];
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    // Bits of a message that must survive untouched: code, links, mentions,
    // custom emoji, timestamps, :shortcodes:, @everyone/@here, and slang like lol/lmao.
    const PROTECTED = /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<[^<>\s]+>|:[\w~-]+:|@everyone|@here|\bl+o+(?:l+o+)*l+\b|\bl+m+f*a+o+\b|\brofl\b/gi;

    function keepCase(original, replacement) {
        return original === original.toUpperCase() && original !== original.toLowerCase()
            ? replacement.toUpperCase()
            : replacement;
    }

    function handleSwears(text, mode) {
        if (mode === "keep") return text;
        for (const [re, cute] of SWEARS) {
            text = text.replace(re, (m, ...groups) => {
                if (mode === "censor") return m[0] + "*".repeat(m.length - 1);
                const rep = cute.replace(/\$(\d)/g, (_, i) => typeof groups[i - 1] === "string" ? groups[i - 1] : "");
                return keepCase(m, rep);
            });
        }
        return text;
    }

    function uwuText(text, faceChance, stutterChance) {
        let out = handleSwears(text, cfg.swears)
            .replace(/\b(you)\b/gi, m => keepCase(m, "yuw"))
            .replace(/\b(the)\b/gi, m => keepCase(m, "da"))
            .replace(/\b(love)\b/gi, m => keepCase(m, "wuv"))
            .replace(/\b(what)\b/gi, m => keepCase(m, "wat"))
            .replace(/\b(this)\b/gi, m => keepCase(m, "dis"))
            .replace(/\b(cute)\b/gi, m => keepCase(m, "kawaii"))
            .replace(/\b(hi|hello)\b/gi, m => keepCase(m, "hewwo"))
            .replace(/ove/g, "uv")
            .replace(/OVE/g, "UV")
            .replace(/[rl]/g, "w")
            .replace(/[RL]/g, "W")
            .replace(/n([aeiou])/g, "ny$1")
            .replace(/N([aeiou])/g, "Ny$1")
            .replace(/N([AEIOU])/g, "NY$1");

        if (stutterChance > 0) {
            out = out.replace(/(^|\s)([a-zA-Z])/g, (m, pre, ch) =>
                Math.random() < stutterChance ? `${pre}${ch}-${ch}` : m);
        }

        if (faceChance > 0) {
            // after sentence-ending punctuation
            out = out.replace(/([.!?]+)(\s+|$)/g, (m, punct, space) =>
                Math.random() < faceChance ? `${punct} ${pick(FACES)}${space}` : m);
        }

        return out;
    }

    function uwuify(content) {
        const { faces, stutter } = cfg;
        let result = "";
        let last = 0;
        PROTECTED.lastIndex = 0;
        let match;
        while ((match = PROTECTED.exec(content)) !== null) {
            result += uwuText(content.slice(last, match.index), faces, stutter) + match[0];
            last = match.index + match[0].length;
        }
        result += uwuText(content.slice(last), faces, stutter);

        // always end on a face if nothing got added and the message has words in it
        if (faces > 0 && /[a-z]/i.test(result) && !FACES.some(f => result.includes(f)) && Math.random() < faces) {
            result = result.trimEnd() + " " + pick(FACES);
        }
        return result;
    }

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
            data.content = uwuify(data.content);
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
            this.__uwu = shouldRewrite.bind(null, method, url);
            return open.apply(this, arguments);
        };
        XHR.send = function (body) {
            if (this.__uwu && this.__uwu()) body = rewriteBody(body);
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
            bubble.textContent = "uwu";
            bubble.style.opacity = cfg.active ? "0.9" : "0.35";
            bubble.style.textDecoration = cfg.active ? "none" : "line-through";
            bubble.title = (cfg.active ? "UwU mode ON" : "UwU mode off") + " (tap to toggle, hold for settings)";
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

        panel.appendChild(el("div", { fontWeight: "800", fontSize: "16px", color: "#ff73c6" }, { textContent: "Uwuifier" }));

        const on = checkbox("Uwuify my messages", "active", setActive);
        const edits = checkbox("Uwuify edits too", "editsToo");
        const stutter = slider("Stutter", "stutter");
        const faces = slider("Faces (:3, >w<, nyaa~)", "faces");

        const swearRow = el("label", { display: "block", margin: "10px 0 0" });
        swearRow.appendChild(el("div", { marginBottom: "4px" }, { textContent: "Swear words" }));
        const swears = el("select", { width: "100%", padding: "4px", background: "#1e1f22", color: "#f2f3f5", border: "1px solid #555", borderRadius: "6px" });
        for (const [value, text] of [["cute", "Cute-ify (fuck → fwick)"], ["keep", "Leave as-is"], ["censor", "Censor (f***)"]])
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
