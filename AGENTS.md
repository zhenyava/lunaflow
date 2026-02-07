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

### Import Organization
```typescript
// 1. React hooks and libraries
import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';

// 2. Local imports (type imports first)
import type { CalendarEvent, EventType } from '../types';
import { getLocalEvents } from '../services/storageService';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
```

### Component Structure
```typescript
// 1. Imports (React, external libraries, local imports)
// 2. Constants and interfaces
// 3. Component function
// 4. State declarations (grouped by purpose)
// 5. Effects and callbacks
// 6. Render logic
```

### Naming Conventions
- **Components**: PascalCase (e.g., `CalendarApp`, `MobileCalendarView`)
- **Hooks**: camelCase with `use` prefix (e.g., `useCalendarEvents`, `useCycleStats`)
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

## Testing Guidelines

### Test Structure (Vitest)
```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from './service';

describe('serviceName', () => {
  const createTestData = (params) => ({ /* test data */ });

  describe('functionName', () => {
    it('should handle expected case', () => {
      // Arrange
      const input = createTestData('valid');
      
      // Act
      const result = functionToTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

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
- **Separate mobile/desktop views** when needed
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