UWUIFIER - a Vencord plugin
===========================
Everything you send on Discord gets turned into owo/uwu speak the moment you hit enter.
Pings, links, `code`, :emojis: and @everyone are left alone so they still work.

  "Hello there, I really love this game!"  ->  "hewwo thewe, I weawwy wuv dis g-game! >w<"

ON/OFF
  - Pink "uwu" button in the chat bar (red line through it = off)
  - Ctrl+Shift+U
  - Settings > Plugins > Uwuifier

SETTINGS (cog icon on the plugin)
  - Swear words: cute-ify (fuck -> fwick, shit -> poopy) / leave as-is / censor (f***)
  - Stutter chance, face chance (owo, >w<, :3 ...), uwuify edits too

INSTALL
  Custom plugins only work on a Vencord built from source, so normal Vencord can't just load this file.
  You need Git (https://git-scm.com) and Node.js LTS (https://nodejs.org) installed first.

  Easy way: unzip this folder, double-click INSTALL.bat, follow the prompts.
    (It downloads Vencord into %USERPROFILE%\Vencord, adds the plugin, builds, then
     opens the official Vencord installer - pick your Discord and hit Install.)

  Manual way:
    git clone https://github.com/Vendicated/Vencord
    copy the "uwuifier" folder into Vencord\src\userplugins\
    cd Vencord
    npx pnpm@11.9.0 install --frozen-lockfile
    npx pnpm@11.9.0 build
    npx pnpm@11.9.0 inject

  Then in Discord: Settings > Plugins > search "Uwuifier" > enable.

UPDATING
  Just run INSTALL.bat again.
