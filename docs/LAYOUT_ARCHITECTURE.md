# LunaFlow - Layout Architecture & Responsive Design Guidelines

This document outlines the core layout architecture for LunaFlow's calendar views. Future agents modifying UI components **must** adhere to these principles to maintain the native, app-like feel and prevent layout collapse or overflow across different screen sizes.

## 1. The "Gold Standard" Desktop Approach

LunaFlow is designed to feel like a native application rather than a traditional scrolling webpage. To achieve this, the primary `DesktopCalendarView` uses a constrained flexbox/grid layout that bounds the application strictly to the viewport, only falling back to scrollbars under specific minimum dimensions.

### Core Desktop Constraints (`DesktopCalendarView.tsx`)
- **Outer Wrapper:** Must utilize `flex-1 min-h-0 overflow-auto`. The `min-h-0` is critical for nested flex children to prevent them from growing infinitely based on their content, forcing them to respect the bounds of their parent.
- **Minimum Dimensions (The Gold Standard):**
  - `min-h-[600px]`: Ensures the 4x3 grid doesn't squash vertically on standard laptop screens (1366x768 or 1440x900) minus browser UI.
  - `min-w-[768px]`: Ensures the calendar maintains structural integrity before snapping to the mobile view. Perfect for users snapping the browser to half of a 1920x1080 monitor.
- **Centering:** The grid uses `mx-auto` inside the scrolling container instead of flex centering (`justify-center items-center`).
  - *Why?* Flex centering a child larger than its parent forces the overflow to expand in *both* directions, hiding the top/left content off-screen where scrollbars cannot reach it. `mx-auto` ensures scrolling always starts cleanly from the top-left edge.

## 2. Calendar Month Scaling Strategy

The internal calendar (`CalendarMonth.tsx`) is designed using **percentage-based CSS flex properties** rather than strictly rigid heights, allowing it to stretch flawlessly to fill any container size.

### Component Overrides & React-Day-Picker (v9+)
We override `react-day-picker` components with simple `div` tags. By default, `react-day-picker` uses semantic table structures (`table`, `tbody`, `tr`, `td`), which browsers scale idiosyncratically and often resist flexbox instructions.
- **RDP v9 Wrappers:** `react-day-picker` v9 introduces an intermediate `<div class="rdp-months">` wrapper. When utilizing Tailwind class overrides via the `classNames` prop, this specific wrapper **must** be targeted with `w-full h-full flex flex-col flex-1` to maintain the CSS height inheritance chain. If omitted, the wrapper defaults to a block element, causing the entire calendar to collapse vertically on large screens.

### Percentage Scaling Logic
Instead of `flex-1` which can compress or fail depending on deep DOM structures, we use exact percentages to distribute vertical space.
- **Root/Months:** `w-full h-full flex flex-col`
- **Caption (Header):** `h-[15%]`
- **Grid Wrapper:** `h-[85%]`
  - **Weekdays Row:** `h-[14.28%]` (100% / 7 columns)
  - **Weeks Wrapper:** `h-[85.72%]`
    - **Individual Week Row:** `h-[16.66%]` (100% / 6 potential rows)

### Responsive Typography
Text sizing utilizes standard Tailwind breakpoints (`text-xs md:text-sm lg:text-base`) paired with dynamic container sizing to ensure numbers remain legible on 4K monitors but don't overflow their circular constraints on a 13-inch laptop. *Do not use `@container` queries for fundamental typography in the grid, as they evaluate relative to the massive parent card and cause oversized numbers.*

## 3. Mobile View Hand-off

When the viewport width drops below `768px`, the application gracefully transitions to `MobileCalendarView.tsx`.
- The desktop 4x3 grid is swapped for a single-column, infinite vertical scroll.
- The `min-h` and `min-w` constraints from the desktop view are discarded, fully embracing native document scrolling.

## 4. Mobile Calendar Interaction & Editing UI

### Overview
The mobile version of LunaFlow utilizes a touch-friendly, bottom-heavy interface design. To maximize screen real estate for the calendar grid, primary actions and details are handled via a Floating Action Button (FAB) and Bottom Sheets.

### Core States
The UI behavior is driven by three primary states managed in `CalendarApp.tsx`:
- `selectedDate` (`Date | null`): The currently tapped date for viewing details.
- `isEditMode` (`boolean`): Whether the user is actively painting/toggling events on the calendar.
- `activeType` (`'period' | 'ovulation'`): The type of event currently selected for painting during Edit Mode.

### User Flows

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

### Components Involved

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

### UI/UX Specifications
- **Animations:** Smooth transitions using Tailwind's `animate-in`, `slide-in-from-bottom-4`, and `fade-in`.
- **Accessibility/Ergonomics:** All interactive elements in the bottom sheets and FAB are sized appropriately for touch targets (padding `p-3`, icons `20px`, text `text-sm font-medium`).
- **Z-Index Hierarchy:**
  - Calendar Grid: Base (`z-0`)
  - FAB: `z-30`
  - Backdrop: `z-40`
  - Bottom Sheets (`DayDetailsPanel`, `MobileControls`): `z-50`
