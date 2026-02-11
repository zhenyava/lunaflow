import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import SmartRedirect from './SmartRedirect';
import { LAUNCHED_KEY } from '../constants';
import * as storageService from '../services/storageService';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => {
    mockNavigate(to);
    return null;
  }
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

  it('redirects to /home for a completely new user', () => {
    render(<SmartRedirect />);
    
    // Check if it redirected to /home
    expect(mockNavigate).toHaveBeenCalledWith('/home');
  });

  it('redirects to /calendar if user has LAUNCHED_KEY in localStorage', () => {
    localStorage.setItem(LAUNCHED_KEY, 'true');
    render(<SmartRedirect />);
    
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('redirects to /calendar if user has local events (even without LAUNCHED_KEY)', () => {
    // Mock getLocalEvents to return some events
    vi.spyOn(storageService, 'getLocalEvents').mockReturnValue([{ 
      date: '2023-01-01', 
      type: 'period' 
    }]);

    render(<SmartRedirect />);
    
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('handles storage errors gracefully and redirects to /home', () => {
    // Mock localStorage.getItem to throw an error
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage access denied');
    });

    render(<SmartRedirect />);
    
    expect(mockNavigate).toHaveBeenCalledWith('/home');
  });
});
