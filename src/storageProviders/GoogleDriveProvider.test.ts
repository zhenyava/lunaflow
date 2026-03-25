import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveProvider } from './GoogleDriveProvider';
import * as googleService from '../services/googleService';
import type { DailyRecord } from '../types';

vi.mock('../services/googleService', () => ({
  initializeGoogleApi: vi.fn(),
  signInToGoogle: vi.fn(),
  ensureDriveFileExists: vi.fn(),
  uploadDriveData: vi.fn(),
  fetchDriveDataContent: vi.fn(),
  revokeToken: vi.fn(),
  restoreGapiSession: vi.fn(),
}));

describe('GoogleDriveProvider', () => {
  let provider: GoogleDriveProvider;

  beforeEach(() => {
    provider = new GoogleDriveProvider();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should have the correct name', () => {
    expect(provider.name).toBe('Google Drive');
  });

  it('should initialize Google API', () => {
    const onInit = vi.fn();
    provider.initialize(onInit);
    expect(googleService.initializeGoogleApi).toHaveBeenCalledWith(onInit);
  });

  it('should sign in to Google', async () => {
    await provider.signIn();
    expect(googleService.signInToGoogle).toHaveBeenCalled();
  });

  it('should sign out from Google', async () => {
    await provider.signOut();
    expect(googleService.revokeToken).toHaveBeenCalled();
  });

  it('should ensure drive file exists', async () => {
    vi.mocked(googleService.ensureDriveFileExists).mockResolvedValue('file-id');
    const fileId = await provider.ensureFileExists();
    expect(fileId).toBe('file-id');
    expect(googleService.ensureDriveFileExists).toHaveBeenCalled();
  });

  it('should fetch data from drive', async () => {
    const mockData = { records: [] };
    vi.mocked(googleService.fetchDriveDataContent).mockResolvedValue(mockData);
    const data = await provider.fetchData('file-id');
    expect(data).toBe(mockData);
    expect(googleService.fetchDriveDataContent).toHaveBeenCalledWith('file-id');
  });

  it('should upload data to drive', async () => {
    const events: DailyRecord[] = [];
    await provider.uploadData('file-id', events);
    expect(googleService.uploadDriveData).toHaveBeenCalledWith('file-id', events);
  });

  it('should return true for isAuthenticated when token exists', () => {
    localStorage.setItem('LUNA_AUTH_TOKEN', 'test-token');
    expect(provider.isAuthenticated()).toBe(true);
  });

  it('should return false for isAuthenticated when token does not exist', () => {
    expect(provider.isAuthenticated()).toBe(false);
  });

  it('should restore session when token exists', async () => {
    const token = { access_token: 'test-token' };
    localStorage.setItem('LUNA_AUTH_TOKEN', JSON.stringify(token));
    vi.mocked(googleService.ensureDriveFileExists).mockResolvedValue('file-id');

    const fileId = await provider.restoreSession();
    
    expect(fileId).toBe('file-id');
    expect(googleService.restoreGapiSession).toHaveBeenCalledWith(token);
    expect(googleService.ensureDriveFileExists).toHaveBeenCalled();
  });

  it('should return null for restoreSession when no token exists', async () => {
    const fileId = await provider.restoreSession();
    expect(fileId).toBeNull();
  });
});
