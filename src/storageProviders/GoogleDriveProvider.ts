import type { DailyRecord, GoogleToken } from '../types';
import { 
  initializeGoogleApi, 
  signInToGoogle, 
  ensureDriveFileExists, 
  uploadDriveData, 
  fetchDriveDataContent,
  revokeToken,
  restoreGapiSession
} from '../services/googleService';
import { GOOGLE_SCOPES } from '../constants';
import type { RemoteStorageProvider } from './RemoteStorageProviderInterface';

/**
 * Google Drive implementation of the RemoteStorageProvider.
 */
export class GoogleDriveProvider implements RemoteStorageProvider {
  readonly id = 'google-drive';
  readonly name = 'Google Drive';

  handleCallback(): void {
    if (window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = params.get('access_token');
      const expiresInStr = params.get('expires_in');
      
      if (accessToken && expiresInStr) {
        const expiresIn = parseInt(expiresInStr, 10);
        const expiresAt = Date.now() + (expiresIn * 1000);
        
        const token: GoogleToken = {
          access_token: accessToken,
          expires_in: expiresIn,
          scope: GOOGLE_SCOPES,
          token_type: 'Bearer',
          expires_at: expiresAt
        };
        
        localStorage.setItem('LUNA_AUTH_TOKEN', JSON.stringify(token));
        
        // Clean the URL hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }

  initialize(onInit: (success: boolean) => void): void {
    initializeGoogleApi(onInit);
  }

  async signIn(): Promise<void> {
    await signInToGoogle();
  }

  async signOut(): Promise<void> {
    await revokeToken();
  }

  async ensureFileExists(): Promise<string> {
    return await ensureDriveFileExists();
  }

  async fetchData(fileId: string): Promise<unknown> {
    return await fetchDriveDataContent(fileId);
  }

  async uploadData(fileId: string, events: DailyRecord[]): Promise<void> {
    await uploadDriveData(fileId, events);
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('LUNA_AUTH_TOKEN');
    return !!token;
  }

  async restoreSession(): Promise<string | null> {
    try {
      const storedTokenStr = localStorage.getItem('LUNA_AUTH_TOKEN');
      if (storedTokenStr) {
        const token: GoogleToken = JSON.parse(storedTokenStr);
        restoreGapiSession(token);
        
        // Return file ID if session restoration is successful
        const fileId = await this.ensureFileExists();
        return fileId;
      }
    } catch (error) {
      console.error('Google session restoration failed', error);
      localStorage.removeItem('LUNA_AUTH_TOKEN');
    }
    return null;
  }
}

// Export a singleton instance
export const googleDriveProvider = new GoogleDriveProvider();
