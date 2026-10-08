(() => {
    /*
     * Uwuifier for Discord mobile, a Vendetta-style plugin (works in Bunny forks
     * like Kettu / Revenge). Same uwu rules as the desktop Vencord plugin.
     *
     * Plain JS on purpose: no build step, the mod evals this file as-is.
     * The whole file is one expression returning { onLoad, onUnload, settings }.
     */
    // NOTE: nothing may come before "(() =>" on line 1. The mod evals this as
    // `return <file>`, and a leading comment would trigger ASI and return undefined.
    const { metro, patcher, commands, storage: storageApi, ui, plugin } = vendetta;
    const { React, ReactNative: RN } = metro.common;
    const store = plugin.storage;

    // ---- settings defaults -------------------------------------------------
    const DEFAULTS = { active: true, stutter: 0.1, faces: 0.5, editsToo: true, swears: "cute" };
    for (const k in DEFAULTS) if (store[k] === undefined) store[k] = DEFAULTS[k];

    // ---- uwu rules (kept in sync with desktop/uwuifier/index.tsx) ----------
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
        let out = handleSwears(text, store.swears)
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
        const { faces, stutter } = store;
        let result = "";
        let last = 0;

        // exec loop instead of matchAll, older Hermes builds lack it
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

    // ---- helpers -------------------------------------------------------------
    function toast(text) {
        try {
            const icon = ui.assets && ui.assets.getAssetIDByName ? ui.assets.getAssetIDByName("Check") : undefined;
            ui.toasts.showToast(text, icon);
        } catch { }
    }

    function toggle() {
        store.active = !store.active;
        toast(store.active ? "UwU mode ON >w<" : "UwU mode off");
    }

    // Text /uwu just produced, so the sendMessage patch doesn't uwuify it twice.
    let fromCommand = null;

    // ---- plugin lifecycle ----------------------------------------------------
    const unpatches = [];

    function onLoad() {
        const MessageActions = metro.findByProps("sendMessage", "editMessage")
            || metro.findByProps("sendMessage", "receiveMessage");
        if (!MessageActions) {
            toast("Uwuifier: couldn't find Discord's message module, sowwy");
            return;
        }

        // sendMessage(channelId, message, ...)
        unpatches.push(patcher.before("sendMessage", MessageActions, args => {
            const msg = args[1];
            if (!msg || typeof msg.content !== "string" || !msg.content) return;
            if (fromCommand !== null && msg.content === fromCommand) {
                fromCommand = null;
                return;
            }
            if (store.active) msg.content = uwuify(msg.content);
        }));

        // editMessage(channelId, messageId, message)
        if (typeof MessageActions.editMessage === "function") {
            unpatches.push(patcher.before("editMessage", MessageActions, args => {
                const msg = args[2];
                if (store.active && store.editsToo && msg && typeof msg.content === "string" && msg.content)
                    msg.content = uwuify(msg.content);
            }));
        }

        // No chat bar button on mobile, so toggling lives in slash commands.
        unpatches.push(commands.registerCommand({
            name: "uwutoggle",
            displayName: "uwutoggle",
            description: "Turn auto-uwuifying on or off",
            displayDescription: "Turn auto-uwuifying on or off",
            options: [],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute: () => { toggle(); },
        }));

        unpatches.push(commands.registerCommand({
            name: "uwu",
            displayName: "uwu",
            description: "Send one uwuified message (works even when auto mode is off)",
            displayDescription: "Send one uwuified message (works even when auto mode is off)",
            options: [{
                name: "text",
                displayName: "text",
                description: "What to say",
                displayDescription: "What to say",
                type: 3,
                required: true,
            }],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute: args => {
                const arg = args.find(a => a.name === "text");
                const text = arg ? String(arg.value) : "";
                if (!text) return;
                fromCommand = uwuify(text);
                return { content: fromCommand };
            },
        }));
    }

    function onUnload() {
        for (const un of unpatches.splice(0)) {
            try { un(); } catch { }
        }
    }

    // ---- settings page -------------------------------------------------------
    const h = React.createElement;
    const CHANCES = [["Off", 0], ["A little", 0.1], ["Some", 0.25], ["Lots", 0.5], ["Always", 1]];
    const SWEAR_MODES = [
        ["cute", "Cute-ify them (fuck → fwick, shit → poopy, hell → heck)"],
        ["keep", "Leave them as-is (just the normal uwu rules)"],
        ["censor", "Censor them (f**k)"],
    ];

    function Settings() {
        storageApi.useProxy(store);
        const Forms = ui.components && ui.components.Forms;

        if (!Forms || !Forms.FormSwitchRow || !Forms.FormRadioRow) {
            // Mod build without the old Forms components: at least say how to toggle.
            return h(RN.ScrollView, { style: { padding: 16 } },
                h(RN.Text, { style: { color: "#ccc", fontSize: 16 } },
                    `UwU mode is ${store.active ? "ON" : "off"}. Type /uwutoggle in any chat to flip it, or /uwu <text> for a single message.`));
        }

        const { FormSection, FormSwitchRow, FormRadioRow, FormDivider } = Forms;
        const radioGroup = (title, key, choices) => h(FormSection, { title },
            choices.map(([label, value], i) => h(React.Fragment, { key: String(value) },
                i > 0 && FormDivider ? h(FormDivider) : null,
                h(FormRadioRow, { label, selected: store[key] === value, onPress: () => { store[key] = value; } }))));

        return h(RN.ScrollView, { style: { flex: 1 } },
            h(FormSection, { title: "Uwuifier" },
                h(FormSwitchRow, {
                    label: "Uwuify outgoing messages",
                    subLabel: "Same as typing /uwutoggle in chat",
                    value: !!store.active,
                    onValueChange: v => { store.active = v; },
                }),
                FormDivider ? h(FormDivider) : null,
                h(FormSwitchRow, {
                    label: "Uwuify edits too",
                    value: !!store.editsToo,
                    onValueChange: v => { store.editsToo = v; },
                })),
            radioGroup("Swear words", "swears", SWEAR_MODES.map(([v, l]) => [l, v])),
            radioGroup("Stutter chance (s-s-stutter)", "stutter", CHANCES),
            radioGroup("Face chance (owo, >w<, ...)", "faces", CHANCES));
    }

    return { onLoad, onUnload, settings: Settings, uwuify };
})()
