/*
 * Uwuifier — a Vencord user plugin.
 * Rewrites everything you send (and edit) into owo/uwu speak, with a
 * one-click toggle in the chat bar and a Ctrl+Shift+U hotkey.
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { showToast } from "@webpack/common";

const settings = definePluginSettings({
    active: {
        type: OptionType.BOOLEAN,
        description: "Uwuify outgoing messages (same as the chat bar button / Ctrl+Shift+U)",
        default: true,
    },
    hotkey: {
        type: OptionType.BOOLEAN,
        description: "Ctrl+Shift+U toggles uwuifying on and off",
        default: true,
    },
    stutter: {
        type: OptionType.SLIDER,
        description: "Chance a word gets a s-s-stutter",
        markers: [0, 0.1, 0.2, 0.3, 0.5],
        default: 0.1,
        stickToMarkers: false,
    },
    faces: {
        type: OptionType.SLIDER,
        description: "Chance a face (:3, >w<, ...) gets added after a sentence",
        markers: [0, 0.25, 0.5, 0.75, 1],
        default: 0.5,
        stickToMarkers: false,
    },
    editsToo: {
        type: OptionType.BOOLEAN,
        description: "Also uwuify messages when you edit them",
        default: true,
    },
    swears: {
        type: OptionType.SELECT,
        description: "What happens to swear words",
        options: [
            { label: "Cute-ify them (fuck → fwick, shit → poopy, hell → heck)", value: "cute", default: true },
            { label: "Leave them as-is (just the normal uwu rules)", value: "keep" },
            { label: "Censor them (f**k)", value: "censor" },
        ],
    },
});

// Stems, so "fucking", "bullshit", "motherfucker" etc. are caught too.
const SWEARS: [RegExp, string][] = [
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

function handleSwears(text: string, mode: string) {
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

const FACES = [":3", ":3", ">w<", "^w^", ":3", ":3", "(・`ω´・)", ":3", "x3", "nyaa~", "rawr x3", "(˘ω˘)", "ʘwʘ", "( ᵘ ꒳ ᵘ ✼)"];
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// Bits of a message that must survive untouched: code, links, mentions,
// custom emoji, timestamps, :shortcodes:, @everyone/@here, and slang like lol/lmao.
const PROTECTED = /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|<[^<>\s]+>|:[\w~-]+:|@everyone|@here|\bl+o+(?:l+o+)*l+\b|\bl+m+f*a+o+\b|\brofl\b/gi;

function keepCase(original: string, replacement: string) {
    return original === original.toUpperCase() && original !== original.toLowerCase()
        ? replacement.toUpperCase()
        : replacement;
}

function uwuText(text: string, faceChance: number, stutterChance: number) {
    let out = handleSwears(text, settings.store.swears)
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

export function uwuify(content: string) {
    const { faces, stutter } = settings.store;
    let result = "";
    let last = 0;

    for (const match of content.matchAll(PROTECTED)) {
        result += uwuText(content.slice(last, match.index), faces, stutter) + match[0];
        last = match.index! + match[0].length;
    }
    result += uwuText(content.slice(last), faces, stutter);

    // always end on a face if nothing got added and the message has words in it
    if (faces > 0 && /[a-z]/i.test(result) && !FACES.some(f => result.includes(f)) && Math.random() < faces) {
        result = result.trimEnd() + " " + pick(FACES);
    }

    return result;
}

function toggle() {
    settings.store.active = !settings.store.active;
    showToast(settings.store.active ? "UwU mode ON >w<" : "UwU mode off", settings.store.active ? "success" : "message");
}

function onKeyDown(e: KeyboardEvent) {
    if (!settings.store.hotkey) return;
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyU") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
    }
}

function UwuIcon({ height = 20, width = 20, className, active = true }: { height?: number | string; width?: number | string; className?: string; active?: boolean; }) {
    return (
        <svg viewBox="0 0 24 24" height={height} width={width} className={className} aria-hidden="true">
            <text
                x="12" y="16.5" textAnchor="middle"
                fontSize="11" fontWeight="800" fontFamily="sans-serif"
                fill={active ? "#ff73c6" : "currentColor"}
            >
                uwu
            </text>
            {!active && <line x1="3" y1="21" x2="21" y2="3" stroke="var(--status-danger, #f23f43)" strokeWidth="2.2" strokeLinecap="round" />}
        </svg>
    );
}

const UwuChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const { active } = settings.use(["active"]);
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={active ? "UwU mode: ON (click or Ctrl+Shift+U to turn off)" : "UwU mode: off (click or Ctrl+Shift+U to turn on)"}
            onClick={toggle}
        >
            <UwuIcon active={active} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "Uwuifier",
    description: "Turns evewything yuw send into owo/uwu speak >w< — toggle with the chat bar button or Ctrl+Shift+U",
    authors: [{ name: "you", id: 0n }],
    settings,

    chatBarButton: {
        icon: UwuIcon,
        render: UwuChatBarButton,
    },

    onBeforeMessageSend(_channelId, msg) {
        if (settings.store.active && msg.content) msg.content = uwuify(msg.content);
    },

    onBeforeMessageEdit(_channelId, _messageId, msg) {
        if (settings.store.active && settings.store.editsToo && msg.content) msg.content = uwuify(msg.content);
    },

    start() {
        document.addEventListener("keydown", onKeyDown, true);
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown, true);
    },
});
