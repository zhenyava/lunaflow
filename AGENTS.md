# LunaFlow - Agent Development Guidelines

This document provides essential information for AI agents working on the LunaFlow codebase.

## Project Overview

LunaFlow is a privacy-focused menstrual cycle and ovulation tracking web application built with React 19, TypeScript, and Vite. The app features local-first data storage with optional Google Drive synchronization.

## Development Commands

### Core Commands

```bash
npm run dev          # Start development server (http://localhost:5173)
npm run build        # Type check + production build
npm run lint         # Run ESLint on all files
npm run test         # Run all tests with Vitest
npm run preview      # Preview production build
```

### Testing Commands

```bash
npm run test                    # Run all tests once
npm run test -- --watch         # Run tests in watch mode
npm run test -- statsService    # Run specific test file
npm run test -- -t "test name"  # Run specific test by name
```

## Code Style Guidelines

### TypeScript Configuration

- **Strict mode enabled** with comprehensive linting
- **Target**: ES2022 with modern module resolution
- **No unused locals/parameters** allowed
- **JSX**: React-jsx transform (no React imports needed for JSX)

### Naming Conventions

- **Services**: camelCase (e.g., `statsService`, `storageService`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `INITIAL_START_DATE`, `LAUNCHED_KEY`)
- **Types**: PascalCase for interfaces/types (e.g., `CalendarEvent`, `EventType`)

### State Management Patterns

- Use **custom hooks** for complex state logic
- Separate **UI state** from **data state**
- Local storage persistence handled in hooks/services layer
- Prefer `useCallback` for event handlers passed to children

### Error Handling

- Use **try-catch blocks** for async operations in services
- Return `null` or `undefined` for invalid states rather than throwing
- Implement proper error boundaries for React components
- Console.error for debugging, user-friendly messages for UI

### File Organization

```
src/
├── components/     # React components (UI layer)
├── hooks/         # Custom React hooks (state logic)
├── services/      # Business logic and external APIs
├── pages/         # Route-level components
├── types.ts       # TypeScript definitions
└── constants.ts   # App constants
```

### Documentation: When to read what

- **`docs/features.md`**: Product Requirements Document (PRD). Read this to understand the product requirements, features, and business rules. Update this when adding or changing application features.
- **`docs/AUTH_ARCHITECTURE.md`**: Read for Google OAuth flow, token lifecycle, and session management.
- **`docs/STORAGE_ARCHITECTURE.md`**: Read for local storage logic, data envelope structure, and migrations.
- **`docs/CALCULATION_LOGIC.md`**: Read for the mathematical logic behind cycle averages and future date predictions.
- **`docs/LAYOUT_ARCHITECTURE.md`**: Read for CSS Grid/Flexbox structures, responsive breakpoints, UI component hierarchy, and mobile interaction flows.
- **`docs/PWA_ARCHITECTURE.md`**: Read for service worker strategy, offline behavior, caching rules, cross-browser compatibility, and PWA-specific LLM development rules.

## Testing Guidelines

### Testing Best Practices

- Test **business logic** in services, not UI components
- Use **factory functions** for test data creation
- Cover **edge cases** and error conditions
- Focus on **cycle calculation logic** - it's the core domain
- Mock external dependencies (Google APIs, localStorage)

## Architecture Patterns

### Service Layer

- **Pure functions** for calculations (statsService)
- **Async operations** for external APIs (googleService)
- **Storage abstraction** (storageService)

### Custom Hooks

- **State management** with localStorage persistence
- **API integration** with loading/error states
- **Computed values** using useMemo

### Component Patterns

- **Mobile-first** responsive design
- **Separate mobile/desktop views** when needed (e.g., Floating Action Buttons and Bottom Sheets for mobile)
- **Props drilling** avoided with context/hooks
- **Controlled components** for forms

## Privacy & Security Guidelines

### Data Handling

- **Local-first**: Default to localStorage, not external APIs
- **Optional sync**: Google Drive is opt-in only
- **No tracking**: Avoid analytics or external scripts
- **Environment variables**: Use `.env` for sensitive config

### Google Drive Integration

- **App-specific folder**: Only access `LunaFlow` folder
- **Minimal scope**: Request only necessary permissions
- **Token management**: Handle expiration and refresh securely

## Linting & Code Quality

### ESLint Configuration

- **React Hooks**: Enforce rules of hooks
- **React Refresh**: Enable HMR in development
- **TypeScript**: Strict type checking
- **No unused variables**: Enforce clean code

### CI Pipeline

A GitHub Actions workflow (`.github/workflows/ci.yml`) is set up to automatically run the following checks on every pull request to the `main` branch:

1. `npm run lint` - static analysis
2. `npm run test` - unit tests
3. `npm run build` - build verification

These checks are sequential and must pass before a PR can be merged.

### Before Committing

1. Run `npm run lint` - fix all ESLint errors
2. Run `npm run test` - ensure all tests pass
3. Run `npm run build` - verify production build works
4. Check TypeScript types - no `any` types allowed

## Development Workflow

### Adding New Features

1. Define types in `types.ts` if needed
2. Implement business logic in `services/`
3. Create custom hook in `hooks/` for state management
4. Build UI components in `components/`
5. Add tests for business logic
6. Update routing if needed

### Debugging Tips

- Check **localStorage** for data persistence issues
- Verify **Google API configuration** for sync problems
- Use **React DevTools** for component state debugging
- Check **Vite dev server** logs for build issues

## Common Gotchas

- **Date handling**: Always use `date-fns` for consistent date operations
- **ISO format**: Store dates as `YYYY-MM-DD` strings
- **Mobile scroll**: Use virtualization for long month lists
- **Type safety**: Import types with `import type { ... }`
- **Environment**: Use `VITE_` prefix for environment variables

