// ==UserScript==
// @name         Uwuifier for Discord
// @namespace    https://github.com/fw9c/secret
// @version      1.0.0
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
 * Toggle: the pink "uwu" bubble on the right edge, or Ctrl+Shift+U on a keyboard.
 */
(() => {
    "use strict";

    // ---- settings, edit these if you want -----------------------------------
    const SWEAR_MODE = "cute";   // "cute" (fuck -> fwick), "keep", or "censor" (f***)
    const STUTTER_CHANCE = 0.1;  // 0 to 1
    const FACE_CHANCE = 0.5;     // 0 to 1
    const EDITS_TOO = true;      // uwuify edited messages too

    // Discord deletes window.localStorage once it loads, so grab it first.
    const LS = (() => { try { return window.localStorage; } catch { return null; } })();
    const KEY = "uwuifier-active";
    let active = (() => { try { return LS ? LS.getItem(KEY) !== "0" : true; } catch { return true; } })();

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

    const FACES = ["owo", "uwu", ">w<", "^w^", "OwO", "UwU", "(・`ω´・)", ":3", "x3", "nyaa~", "rawr x3", "(˘ω˘)", "ʘwʘ", "( ᵘ ꒳ ᵘ ✼)"];
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
        let out = handleSwears(text, SWEAR_MODE)
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
        let result = "";
        let last = 0;
        PROTECTED.lastIndex = 0;
        let match;
        while ((match = PROTECTED.exec(content)) !== null) {
            result += uwuText(content.slice(last, match.index), FACE_CHANCE, STUTTER_CHANCE) + match[0];
            last = match.index + match[0].length;
        }
        result += uwuText(content.slice(last), FACE_CHANCE, STUTTER_CHANCE);

        // always end on a face if nothing got added and the message has words in it
        if (FACE_CHANCE > 0 && /[a-z]/i.test(result) && !FACES.some(f => result.includes(f)) && Math.random() < FACE_CHANCE) {
            result = result.trimEnd() + " " + pick(FACES);
        }
        return result;
    }

    // ---- hook outgoing messages ---------------------------------------------
    const SEND = /\/api\/v\d+\/channels\/\d+\/messages(\?|$)/;
    const EDIT = /\/api\/v\d+\/channels\/\d+\/messages\/\d+(\?|$)/;

    function shouldRewrite(method, url) {
        if (!active) return false;
        method = String(method || "GET").toUpperCase();
        url = String(url);
        if (method === "POST" && SEND.test(url)) return true;
        if (method === "PATCH" && EDIT.test(url)) return EDITS_TOO;
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

    // ---- toggle --------------------------------------------------------------
    let bubble = null;

    function paint() {
        if (!bubble) return;
        bubble.textContent = "uwu";
        bubble.style.opacity = active ? "0.9" : "0.35";
        bubble.style.textDecoration = active ? "none" : "line-through";
        bubble.title = active ? "UwU mode ON (tap to turn off)" : "UwU mode off (tap to turn on)";
    }

    function toggle() {
        active = !active;
        try { LS && LS.setItem(KEY, active ? "1" : "0"); } catch { }
        paint();
    }

    function addBubble() {
        if (bubble || !document.body) return;
        bubble = document.createElement("div");
        Object.assign(bubble.style, {
            position: "fixed", right: "0", top: "35%", zIndex: "2147483647",
            background: "#ff73c6", color: "#fff", font: "800 12px sans-serif",
            padding: "8px 6px", borderRadius: "10px 0 0 10px", cursor: "pointer",
            userSelect: "none", boxShadow: "0 2px 6px rgba(0,0,0,.4)",
        });
        bubble.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); toggle(); });
        document.body.appendChild(bubble);
        paint();
    }

    document.addEventListener("keydown", e => {
        if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyU") {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        }
    }, true);

    if (document.body) addBubble();
    else document.addEventListener("DOMContentLoaded", addBubble);
})();
