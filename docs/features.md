# LunaFlow Product Requirements & Features

This document serves as the Product Requirements Document (PRD) for LunaFlow. It describes the application's core functions and business rules from a product perspective. When adding or modifying features, update this document.

## 1. Privacy & Data Storage
- **Local-First Default:** All user data (cycle logs, settings) must be stored locally on the device (via `localStorage`) by default.
- **Zero Tracking:** The application must not use external databases, analytics trackers, or third-party cookies that compromise user privacy.

## 2. Google Drive Synchronization (Optional)
- **Opt-in Backup:** Users can optionally link their Google Drive to sync and backup their data.
- **App-Specific Folder:** The sync must only request permissions for and access an app-specific `LunaFlow` folder. It must not have access to the user's general Google Drive files.
- **Seamless Merge:** Data from multiple devices synced to the same Google account should be merged intelligently without data loss.

## 3. Cycle & Ovulation Tracking
- **Period Logging:** Users can select any day on the calendar and toggle it as a "Period" day.
- **Ovulation Logging:** Users can select any day on the calendar and mark it as an "Ovulation" day.
- **Batch Editing:** Users should be able to quickly toggle multiple days sequentially without excessive clicks (e.g., via an "Edit Mode").

## 4. Smart Predictions
- **Averages Calculation:** The app calculates the user's average cycle length and average period duration based on historical logs. Outliers (e.g., unusually long gaps) should be ignored in the average calculation.
- **Future Projections:** Based on the calculated averages, the app predicts and highlights future expected periods and ovulation windows on the calendar.

## 5. Responsive Views
- **Desktop View:** On larger screens, the calendar should display in a comprehensive year-view (e.g., a grid of months) that fits within the viewport.
- **Mobile View:** On small screens, the UI must adapt to a mobile-native feel featuring a single-column, infinite vertical scroll, relying on bottom sheets and floating action buttons for interactions.
