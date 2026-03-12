import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
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
    // Default mock for getLocalEvents to return empty array
    vi.spyOn(storageService, 'getLocalEvents').mockReturnValue([]);
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

  it('renders LandingPage for a completely new user', () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('landing-page')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects to /calendar if user has LAUNCHED_KEY in localStorage', () => {
    localStorage.setItem(LAUNCHED_KEY, 'true');
    renderComponent();

    expect(mockNavigate).toHaveBeenCalledWith('/calendar', { replace: true });
  });

  it('redirects to /calendar if user has local events', () => {
    vi.spyOn(storageService, 'getLocalEvents').mockReturnValue([{
      date: '2023-01-01',
      updatedAt: Date.now(), period: {}
    }]);

    renderComponent();

    expect(mockNavigate).toHaveBeenCalledWith('/calendar', { replace: true });
  });

  it('renders LandingPage if navigating from app (fromApp is true in state)', () => {
    localStorage.setItem(LAUNCHED_KEY, 'true');
    renderComponent([{ pathname: '/', state: { fromApp: true } }]);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles storage errors gracefully and renders LandingPage', () => {
    const originalConsoleError = console.error;
    console.error = vi.fn(); // Hide the error in test output

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage access denied');
    });

    const { getByTestId } = renderComponent();

    expect(getByTestId('landing-page')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    console.error = originalConsoleError;
  });
});
