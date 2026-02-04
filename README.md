# LunaFlow

A privacy-focused, client-side period cycle and ovulation tracker with optional Google Drive sync.

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

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Drive API**.
3. Create OAuth 2.0 credentials (**Client ID** for Web Application).
4. Add `http://localhost:5173` to "Authorized JavaScript origins".
5. Create a `.env` file in the root directory:
   ```env
   VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   ```
   *Alternatively, you can enter the Client ID directly in the App Settings UI.*

