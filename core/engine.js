// Femboy speak: all lowercase, stretched words, eepy, kitty sounds and :3.
// No baby-talk r/l -> w, that's the e-girl tell.
// femify(text, { swears: "cute" | "keep" | "censor", stutter: 0..1, faces: 0..1 })

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

// Runs on lowercased text, so no /i needed.
const WORDS = [
    [/\b(?:hi+|hello+)\b/g, "hiii"],
    [/\bhe+y+\b/g, "heyyy"],
    [/\bbye+\b/g, "byeee"],
    [/\bgood ?night\b/g, "nini"],
    [/\bthank you\b|\bthanks\b/g, "tysm"],
    [/\byou'?re\b/g, "ur"],
    [/\byour\b/g, "ur"],
    [/\byou\b/g, "u"],
    [/\bbecause\b/g, "bc"],
    [/\bplease\b/g, "pleaseee"],
    [/\bsorry\b/g, "sorryyy"],
    [/\b(?:tired|sleepy)\b/g, "eepy"],
    [/\bsleep(ing|y)?\b/g, "eep$1"],
    [/\bcats\b/g, "kitties"],
    [/\bcat\b/g, "kitty"],
    [/\blove\b/g, "luv"],
    [/\bfriends\b/g, "besties"],
    [/\bfriend\b/g, "bestie"],
    [/\bha(?:ha)+\b/g, "hehe"],
    [/\byes\b/g, "yesss"],
    [/\bok(?:ay)?\b/g, "okie"],
    [/\bomg\b/g, "omggg"],
    [/\bcute\b/g, "cuteee"],
    [/\bsilly\b/g, "sillyyy"],
];

const FACES = [":3", ":3", ":3c", "x3", ">w<", ">///<", "^^", "^-^", "mrrp", "mrow~", "nya~", "meow", "hehe~", "awawa", "=^.^="];
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

    // Nobody types full stops like this: drop them or turn them into ~
    out = out.replace(/(\w)\.(\s|$)/g, (m, ch, space) => Math.random() < 0.5 ? `${ch}~${space}` : `${ch}${space}`);

    if (opts.faces > 0) {
        // after ! ? or ~ at the end of a sentence
        out = out.replace(/([!?~]+)(\s+|$)/g, (m, end, space) =>
            Math.random() < opts.faces ? `${end} ${pick(FACES)}${space}` : m);
    }

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

    // always end on a face if nothing got added and the message has words in it
    if (opts.faces > 0 && /[a-z]/i.test(result) && !FACES.some(f => result.includes(f)) && Math.random() < opts.faces) {
        result = result.trimEnd() + " " + pick(FACES);
    }
    return result;
}
