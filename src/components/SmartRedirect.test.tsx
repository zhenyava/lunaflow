import { makePeriodRecord } from '../types';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import SmartRedirect from './SmartRedirect';
import { LAUNCHED_KEY } from '../constants';
import * as storageService from '../services/storageService';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockNavigate = vi.fn();

// Mock react-router-dom properly for module
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate};
});

// Mock LandingPage
vi.mock('./LandingPage', () => ({
  default: () => <div data-testid="landing-page">Landing Page Mock</div>
}));

describe('SmartRedirect', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
    // Default mock for getStoredEvents to return empty array
    vi.spyOn(storageService, 'getStoredEvents').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (initialEntries: string[] | { pathname: string, state?: Record<string, unknown> }[] = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders LandingPage for a completely new user', async () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('landing-page')).toBeInTheDocument();
    // Wait for async effect to complete
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('redirects to /calendar if user has LAUNCHED_KEY in localStorage', async () => {
    localStorage.setItem(LAUNCHED_KEY, 'true');
    renderComponent();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/calendar', { replace: true });
    });
  });

  it('redirects to /calendar if user has stored events', async () => {
    vi.spyOn(storageService, 'getStoredEvents').mockResolvedValue([makePeriodRecord('2023-01-01')]);

    renderComponent();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/calendar', { replace: true });
    });
  });

  it('renders LandingPage if navigating from app (fromApp is true in state)', async () => {
    localStorage.setItem(LAUNCHED_KEY, 'true');
    renderComponent([{ pathname: '/', state: { fromApp: true } }]);
    // Wait a tick for any async effects
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('handles storage errors gracefully and renders LandingPage', async () => {
    const originalConsoleError = console.error;
    console.error = vi.fn(); // Hide the error in test output

    vi.spyOn(storageService, 'getStoredEvents').mockRejectedValue(new Error('Storage access denied'));

    const { getByTestId } = renderComponent();

    expect(getByTestId('landing-page')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    console.error = originalConsoleError;
  });
});
