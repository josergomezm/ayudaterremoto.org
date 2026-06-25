# App icon & splash sources

No binary assets ship in the scaffold. To generate native icons and splash screens:

1. Drop a **1024×1024** `icon.png` and a **2732×2732** `splash.png` into this folder.
   Optionally add `icon-foreground.png` / `icon-background.png` for Android adaptive icons.
2. Run `npm run cap:assets` — [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets)
   generates every required iOS and Android size directly into the native projects.
3. Re-run after every `npx cap add <platform>`.
