# LunaFlow

A privacy-focused, client-side period cycle and ovulation tracker with optional Google Drive sync.

https://www.lunaflow.fit/

## ✨ Features

- **🔒 Privacy First**: All data is stored locally on your device by default. No external database tracks you.
- **☁️ Google Drive Sync**: Optional, secure backup to your own personal Google Drive (app-specific folder only - LunaFlow).
- **📅 Cycle Tracking**: Easily log menstrual periods and ovulation days.
- **🔮 Smart Predictions**: Automatic calculation of cycle averages and future period predictions based on your history.
- **📱 Responsive Design**: "Infinite" vertical scroll for mobile and a comprehensive year-view for desktop.

### Installation

1. clone repository
2. cal ```npm instal```
3. call ```npm run dev```
4. Open your browser at `http://localhost:5173`.

### (Optional) To enable the Google Drive Sync locally:

1.  Set up a project in [Clerk](https://clerk.com/).
2.  Enable **Google SSO** in the Clerk dashboard.
3.  Add the `https://www.googleapis.com/auth/drive.file` scope in Clerk's Google SSO settings.
4.  Create a `.env` file in the root directory:
    ```env
    VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
    CLERK_SECRET_KEY=sk_test_...
    ```
5.  Run `npm run dev` and sign in.
