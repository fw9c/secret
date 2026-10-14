(() => {
    /*
     * Uwuifier for Discord mobile, a Vendetta-style plugin (works in Bunny forks
     * like Kettu / Revenge). Same cat boy speak rules as the desktop Vencord plugin.
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
    const DEFAULTS = { active: true, stutter: 0, faces: 0.5, editsToo: true, swears: "keep" };
    for (const k in DEFAULTS) if (store[k] === undefined) store[k] = DEFAULTS[k];
    // v2 (cat boy) switched the defaults to no stutter and swears left alone.
    if (store.v !== 2) {
        store.v = 2;
        store.stutter = DEFAULTS.stutter;
        store.swears = DEFAULTS.swears;
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

    // ---- helpers -------------------------------------------------------------
    function toast(text) {
        try {
            const icon = ui.assets && ui.assets.getAssetIDByName ? ui.assets.getAssetIDByName("Check") : undefined;
            ui.toasts.showToast(text, icon);
        } catch { }
    }

    function toggle() {
        store.active = !store.active;
        toast(store.active ? "fm mode on :3" : "fm mode off");
    }

    // Text /fm just produced, so the sendMessage patch doesn't change it twice.
    let fromCommand = null;

    // ---- plugin lifecycle ----------------------------------------------------
    const unpatches = [];

    function onLoad() {
        const MessageActions = metro.findByProps("sendMessage", "editMessage")
            || metro.findByProps("sendMessage", "receiveMessage");
        if (!MessageActions) {
            toast("Uwuifier: couldn't find Discord's message module :(");
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
            if (store.active) msg.content = femify(msg.content, store);
        }));

        // editMessage(channelId, messageId, message)
        if (typeof MessageActions.editMessage === "function") {
            unpatches.push(patcher.before("editMessage", MessageActions, args => {
                const msg = args[2];
                if (store.active && store.editsToo && msg && typeof msg.content === "string" && msg.content)
                    msg.content = femify(msg.content, store);
            }));
        }

        // No chat bar button on mobile, so toggling lives in slash commands.
        unpatches.push(commands.registerCommand({
            name: "fmtoggle",
            displayName: "fmtoggle",
            description: "Turn fm mode on or off",
            displayDescription: "Turn fm mode on or off",
            options: [],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute: () => { toggle(); },
        }));

        unpatches.push(commands.registerCommand({
            name: "fm",
            displayName: "fm",
            description: "Send one cat boy speak message (works even when fm mode is off)",
            displayDescription: "Send one cat boy speak message (works even when fm mode is off)",
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
                fromCommand = femify(text, store);
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
        ["keep", "Leave them as-is"],
        ["cute", "Cute-ify them (fuck → frick, shit → shoot, hell → heck)"],
        ["censor", "Censor them (f**k)"],
    ];

    function Settings() {
        storageApi.useProxy(store);
        const Forms = ui.components && ui.components.Forms;

        if (!Forms || !Forms.FormSwitchRow || !Forms.FormRadioRow) {
            // Mod build without the old Forms components: at least say how to toggle.
            return h(RN.ScrollView, { style: { padding: 16 } },
                h(RN.Text, { style: { color: "#ccc", fontSize: 16 } },
                    `fm mode is ${store.active ? "on" : "off"}. Type /fmtoggle in any chat to flip it, or /fm <text> for a single message.`));
        }

        const { FormSection, FormSwitchRow, FormRadioRow, FormDivider } = Forms;
        const radioGroup = (title, key, choices) => h(FormSection, { title },
            choices.map(([label, value], i) => h(React.Fragment, { key: String(value) },
                i > 0 && FormDivider ? h(FormDivider) : null,
                h(FormRadioRow, { label, selected: store[key] === value, onPress: () => { store[key] = value; } }))));

        return h(RN.ScrollView, { style: { flex: 1 } },
            h(FormSection, { title: "Uwuifier" },
                h(FormSwitchRow, {
                    label: "fm mode (change outgoing messages)",
                    subLabel: "Same as typing /fmtoggle in chat",
                    value: !!store.active,
                    onValueChange: v => { store.active = v; },
                }),
                FormDivider ? h(FormDivider) : null,
                h(FormSwitchRow, {
                    label: "Change edits too",
                    value: !!store.editsToo,
                    onValueChange: v => { store.editsToo = v; },
                })),
            radioGroup("Swear words", "swears", SWEAR_MODES.map(([v, l]) => [l, v])),
            radioGroup("Stutter chance (s-s-stutter)", "stutter", CHANCES),
            radioGroup("Face chance (:3, mrrp, nya~, ...)", "faces", CHANCES));
    }

    return { onLoad, onUnload, settings: Settings, femify: text => femify(text, store) };
})()
