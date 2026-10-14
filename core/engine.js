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
