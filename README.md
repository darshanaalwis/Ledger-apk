# Ledger: Android accounting app

React app wrapped with Capacitor. Data is saved on the phone.

## Easiest: build the APK online (no Android Studio)
1. Create a free GitHub account and a new empty repository.
2. Upload everything in this folder (keep the `.github` folder).
3. Open the repository's Actions tab, choose "Build Android APK", then Run workflow.
4. After about 5 minutes, open the finished run and download the `ledger-apk` file.
5. Unzip it, copy `app-debug.apk` to your phone, and tap it to install
   (allow "Install unknown apps" when asked).

## Or build on your computer
Needs Node 20+, JDK 17 and Android Studio.

    npm install
    npm run build
    npx cap sync android
    npx cap open android      # then Build > Build APK(s)

## Changing the app
Edit `src/App.jsx`, then run `npm run android:sync` and rebuild.
Change the app name or id in `capacitor.config.json` before publishing.

## Publishing to Google Play
The debug APK is for your own phone and testers. For Play Store you need a
signed release bundle (.aab) and a Google Play developer account.
