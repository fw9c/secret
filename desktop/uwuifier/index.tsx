/*
 * Uwuifier, a Vencord user plugin.
 * Rewrites everything you send (and edit) into cat boy speak (hiii, mrrp, :3),
 * with an "fm" toggle in the chat bar and a Ctrl+Shift+U hotkey.
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { showToast } from "@webpack/common";

const settings = definePluginSettings({
    active: {
        type: OptionType.BOOLEAN,
        description: "Femboy-ify outgoing messages (same as the fm chat bar button / Ctrl+Shift+U)",
        default: true,
    },
    hotkey: {
        type: OptionType.BOOLEAN,
        description: "Ctrl+Shift+U toggles fm mode on and off",
        default: true,
    },
    stutter: {
        type: OptionType.SLIDER,
        description: "Chance a word gets a s-s-stutter",
        markers: [0, 0.1, 0.2, 0.3, 0.5],
        default: 0,
        stickToMarkers: false,
    },
    faces: {
        type: OptionType.SLIDER,
        description: "Chance of a kitty sound or face (:3, mrrp, nya~, ...) at the end of a sentence",
        markers: [0, 0.25, 0.5, 0.75, 1],
        default: 0.5,
        stickToMarkers: false,
    },
    editsToo: {
        type: OptionType.BOOLEAN,
        description: "Also change messages when you edit them",
        default: true,
    },
    swears: {
        type: OptionType.SELECT,
        description: "What happens to swear words",
        options: [
            { label: "Leave them as-is", value: "keep", default: true },
            { label: "Cute-ify them (fuck → frick, shit → shoot, hell → heck)", value: "cute" },
            { label: "Censor them (f**k)", value: "censor" },
        ],
    },
});

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

// Light touch on purpose. Runs on lowercased text, so no /i needed.
const WORDS = [
    [/\b(?:hi+|hello+)\b/g, "hiii"],
    [/\bhe+y+\b/g, "heyyy"],
    [/\bbye+\b/g, "byee"],
    [/\bso\b/g, "soo"],
    [/\bomg\b/g, "omgg"],
    [/\bplease\b/g, "pls"],
    [/\byou'?re\b/g, "ur"],
    [/\byour\b/g, "ur"],
    [/\byou\b/g, "u"],
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

function toggle() {
    settings.store.active = !settings.store.active;
    showToast(settings.store.active ? "fm mode on :3" : "fm mode off", settings.store.active ? "success" : "message");
}

function onKeyDown(e: KeyboardEvent) {
    if (!settings.store.hotkey) return;
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyU") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
    }
}

function FmIcon({ height = 20, width = 20, className, active = true }: { height?: number | string; width?: number | string; className?: string; active?: boolean; }) {
    return (
        <svg viewBox="0 0 24 24" height={height} width={width} className={className} aria-hidden="true">
            <text
                x="12" y="16.5" textAnchor="middle"
                fontSize="13" fontWeight="800" fontFamily="sans-serif"
                fill={active ? "#ff73c6" : "currentColor"}
            >
                fm
            </text>
            {!active && <line x1="3" y1="21" x2="21" y2="3" stroke="var(--status-danger, #f23f43)" strokeWidth="2.2" strokeLinecap="round" />}
        </svg>
    );
}

const FmChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { active } = settings.use(["active"]);
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={active ? "fm mode: on (click or Ctrl+Shift+U to turn off)" : "fm mode: off (click or Ctrl+Shift+U to turn on)"}
            onClick={toggle}
        >
            <FmIcon active={active} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "Uwuifier",
    description: "turns everything u send into cat boy speak :3 (toggle with the fm chat bar button or Ctrl+Shift+U)",
    authors: [{ name: "you", id: 0n }],
    settings,

    chatBarButton: {
        icon: FmIcon,
        render: FmChatBarButton,
    },

    onBeforeMessageSend(_channelId, msg) {
        if (settings.store.active && msg.content) msg.content = femify(msg.content, settings.store);
    },

    onBeforeMessageEdit(_channelId, _messageId, msg) {
        if (settings.store.active && settings.store.editsToo && msg.content) msg.content = femify(msg.content, settings.store);
    },

    start() {
        document.addEventListener("keydown", onKeyDown, true);
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown, true);
    },
});
