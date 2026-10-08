# Uwuifier for phone

Same plugin as the desktop one: everything you send gets uwuified when you hit send.
Pings, links, `code`, :emojis: and @everyone are left alone.

## The catch

Vencord does not run on the Discord phone app at all. Phones need a different mod:
a Vendetta-compatible one, i.e. a Bunny fork like **Kettu** or **Revenge**.
Check which one is still maintained when you install; this scene changes a lot.
This plugin uses the Vendetta plugin API, which those all still support.

- **Android:** install the mod's manager app (an APK from its GitHub), let it
  patch Discord, then open the patched Discord.
- **iPhone:** much more annoying. You have to sideload a patched Discord IPA
  with something like SideStore or AltStore, and a free Apple account means
  re-signing it every 7 days. No way around that without a jailbreak.

## Installing the plugin

Phone mods install plugins from a URL, not a file. The URL has to be public and
point at the folder holding `manifest.json` and `index.js`, ending in `/`.

1. Host the `mobile/uwuifier/` folder somewhere public (see below).
2. In the modded Discord: Settings → (mod name) → Plugins → **+** → paste the URL → Install.
3. Make sure the plugin's switch is on. The cog next to it opens its settings.

### Hosting

`fw9c/secret` is private, so its raw links won't work for anyone. Pick one:

- Make the repo public. Then the URL is
  `https://raw.githubusercontent.com/fw9c/secret/main/mobile/uwuifier/`
- Or copy `manifest.json` and `index.js` into a separate public repo and use that
  repo's raw URL the same way.

## Using it

There's no chat bar button on mobile, so:

- `/uwutoggle`: turn auto-uwuify on or off (default on)
- `/uwu text:<message>`: send one uwuified message, even while auto mode is off
- Plugin settings: on/off, uwuify edits, swear mode (cute-ify / keep / censor),
  stutter chance, face chance

## Editing it

`index.js` is plain JavaScript with no build step. After any change run

    node scripts/update-hash.mjs   # the app only re-downloads when the hash changes
    node scripts/test-mobile.mjs   # loads it like the app does and checks the patches

Keep line 1 as `(() => {`. The app wraps the file as `return <file>`, so a
comment above it makes the whole plugin load as nothing.
