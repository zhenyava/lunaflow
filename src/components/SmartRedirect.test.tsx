import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import SmartRedirect from './SmartRedirect';
import { LAUNCHED_KEY } from '../constants';
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

  it('renders LandingPage if navigating from app (fromApp is true in state)', async () => {
    localStorage.setItem(LAUNCHED_KEY, 'true');
    renderComponent([{ pathname: '/', state: { fromApp: true } }]);
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
