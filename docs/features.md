# Features Specification

## Mobile Calendar Interaction & Editing UI

### 1. Overview
The mobile version of LunaFlow utilizes a touch-friendly, bottom-heavy interface design. To maximize screen real estate for the calendar grid, primary actions and details are handled via a Floating Action Button (FAB) and Bottom Sheets.

### 2. Core States
The UI behavior is driven by three primary states managed in `CalendarApp.tsx`:
- `selectedDate` (`Date | null`): The currently tapped date for viewing details.
- `isEditMode` (`boolean`): Whether the user is actively painting/toggling events on the calendar.
- `activeType` (`'period' | 'ovulation'`): The type of event currently selected for painting during Edit Mode.

### 3. User Flows

#### Flow A: Viewing Day Details (Default Mode)
- **Initial State:** `isEditMode` is `false`, `selectedDate` is `null`.
- **UI Elements:** The "Edit Dates" FAB is visible at the bottom center of the screen.
- **Action:** User taps a specific day on the calendar.
- **Result:**
  1. `selectedDate` is set to the tapped date.
  2. The FAB is hidden (to prevent UI overlap).
  3. The `DayDetailsPanel` slides up from the bottom (Bottom Sheet).
  4. A semi-transparent backdrop (`bg-black/20`) appears behind the panel. Tapping the backdrop dismisses the panel (`selectedDate` becomes `null`).

#### Flow B: Batch Editing Dates (Edit Mode)
- **Initial State:** `isEditMode` is `false`, `selectedDate` is `null`.
- **Action:** User taps the "Edit Dates" FAB.
- **Result:**
  1. `isEditMode` is set to `true`.
  2. The FAB is hidden.
  3. The `MobileControls` panel slides up from the bottom.
  4. The user can select the event type ("Period" or "Ovulation") from the `MobileControls` panel.
  5. Tapping days on the calendar now directly toggles the selected event type for those days (batch editing/painting), rather than opening the details panel.
- **Exit Action:** User taps "Done Editing" on the `MobileControls` panel.
- **Exit Result:** `isEditMode` is set to `false`, `MobileControls` hides, and the FAB reappears.

### 4. Components Involved

#### `CalendarApp.tsx`
- Acts as the state controller.
- Conditionally renders the FAB, `DayDetailsPanel`, and `MobileControls` based on the current state.
- Handles the `onDayClick` routing (either setting `selectedDate` or toggling the event if in edit mode).

#### `MobileControls.tsx`
- A fixed bottom sheet (`footer`) visible only in edit mode.
- Contains toggle buttons for `activeType` ('period' | 'ovulation') and a "Done Editing" button.
- Styled with `backdrop-blur`, safe-area padding (`safe-area-pb`), and shadows to float above the calendar content.

#### `DayDetailsPanel.tsx`
- A fixed bottom sheet for viewing/editing a single day's details.
- Includes animations (`animate-in slide-in-from-bottom-4`).

### 5. UI/UX Specifications
- **Animations:** Smooth transitions using Tailwind's `animate-in`, `slide-in-from-bottom-4`, and `fade-in`.
- **Accessibility/Ergonomics:** All interactive elements in the bottom sheets and FAB are sized appropriately for touch targets (padding `p-3`, icons `20px`, text `text-sm font-medium`).
- **Z-Index Hierarchy:**
  - Calendar Grid: Base (`z-0`)
  - FAB: `z-30`
  - Backdrop: `z-40`
  - Bottom Sheets (`DayDetailsPanel`, `MobileControls`): `z-50`
