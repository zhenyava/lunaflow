import { useState, useEffect, useCallback } from 'react';
import type { DailyRecord, GoogleToken, SyncState } from '../types';
import { 
  initializeGoogleApi, 
  signInToGoogle, 
  ensureDriveFileExists, 
  uploadDriveData, 
  fetchDriveDataContent,
  revokeToken,
  restoreGapiSession
} from '../services/googleService';
import { mergeEvents, saveLocalEvents, parseAndMigrateData } from '../services/storageService';
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from '../constants';

export function eventsEqual(a: DailyRecord[], b: DailyRecord[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0 && b.length === 0) return true;

  // Sort by date to ensure order, then stringify for a deep comparison.
  const sortFn = (x: DailyRecord, y: DailyRecord) => x.date.localeCompare(y.date);
  const stringA = JSON.stringify([...a].sort(sortFn));
  const stringB = JSON.stringify([...b].sort(sortFn));

  return stringA === stringB;
}

interface UseGoogleSyncProps {
  events: DailyRecord[];
  setEvents: React.Dispatch<React.SetStateAction<DailyRecord[]>>;
}

export function useGoogleSync({ events, setEvents }: UseGoogleSyncProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });
  const [isApiInitialized, setIsApiInitialized] = useState(false);
  
  // Use Client ID from constants or fallback to local storage
  const [googleClientId, setGoogleClientId] = useState(() => {
     return GOOGLE_CLIENT_ID || localStorage.getItem('LUNA_GOOGLE_CLIENT_ID') || '';
  });

  // Extract hash token on mount (from Scenario 1 redirect)
  useEffect(() => {
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
  }, []);

  // Init Google API
  useEffect(() => {
    if (googleClientId) {
      initializeGoogleApi(googleClientId, (success) => {
        if (success) {
           setIsApiInitialized(true);
        }
      });
    }
  }, [googleClientId]);

  const handleLogout = useCallback(async () => {
      await revokeToken();
      setIsAuthenticated(false);
      setDriveFileId(null);
      setSyncState({ status: 'idle' });
  }, []);

  // CORE SYNCHRONIZATION LOGIC
  const performFullSync = useCallback(async (fileId: string) => {
    if (!fileId) return;
    setSyncState({ status: 'syncing' });
    try {
        const rawRemoteData = await fetchDriveDataContent(fileId);
        const { records: remoteEvents } = parseAndMigrateData(rawRemoteData);
        const localEvents = events; 
        const merged = mergeEvents(localEvents, remoteEvents);
        
        const isLocalDifferent = !eventsEqual(merged, localEvents);
        if (isLocalDifferent) {
             setEvents(merged);
             saveLocalEvents(merged);
        }

        const isRemoteDifferent = !eventsEqual(merged, remoteEvents);
        if (isRemoteDifferent) {
             await uploadDriveData(fileId, merged);
        }

        setSyncState({ status: 'success', lastSynced: new Date() });
    } catch (error: unknown) {
        const err = error as { message?: string; status?: number };
        if (err.message === 'Unauthorized' || err.status === 401) {
            handleLogout();
        } else {
            setSyncState({ status: 'error' });
        }
    }
  }, [events, setEvents, handleLogout]);

  // Token-based Session Restore
  useEffect(() => {
    if (!isApiInitialized || isAuthenticated) return;

    try {
        const storedTokenStr = localStorage.getItem('LUNA_AUTH_TOKEN');
        if (storedTokenStr) {
            const token: GoogleToken = JSON.parse(storedTokenStr);
            
            // If we have a token, restore session immediately
            // The ensureValidToken logic will handle refresh if it's expired during ensureDriveFileExists
            restoreGapiSession(token);
            setTimeout(() => {
                setIsAuthenticated(true);
                ensureDriveFileExists()
                    .then(id => {
                        setDriveFileId(id);
                        performFullSync(id); 
                    })
                    .catch((err) => {
                        console.error('Session restore failed', err);
                        handleLogout();
                    });
            }, 0);
        }
    } catch {
        localStorage.removeItem('LUNA_AUTH_TOKEN');
    }
  }, [isApiInitialized, isAuthenticated, handleLogout, performFullSync]);

  const handleGoogleLogin = async () => {
    if (!googleClientId) {
      alert("Please enter a Google Client ID in the settings first.");
      return;
    }
    
    try {
      setSyncState({ status: 'syncing' });
      // This will redirect the page, so code after this won't execute normally.
      await signInToGoogle();
    } catch (error: unknown) {
      setSyncState({ status: 'error' });
      setIsAuthenticated(false);
      localStorage.removeItem('LUNA_AUTH_TOKEN');
      let errorMessage = "Login failed.";
      const err = error as { message?: string };
      if (err?.message) errorMessage = err.message;
      alert(errorMessage);
    }
  };

  // Trigger Sync on Window Focus
  useEffect(() => {
      const onFocus = () => {
          if (isAuthenticated && driveFileId && syncState.status !== 'syncing') {
              performFullSync(driveFileId);
          }
      };
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
  }, [isAuthenticated, driveFileId, syncState.status, performFullSync]);

  // Debounced Auto-Save
  useEffect(() => {
    if (!isAuthenticated || !driveFileId) return;
    if (syncState.status === 'success' && Date.now() - (syncState.lastSynced?.getTime() || 0) < 2000) return;

    const timeoutId = setTimeout(async () => {
        setSyncState({ status: 'syncing' });
        try {
            await uploadDriveData(driveFileId, events);
            setSyncState({ status: 'success', lastSynced: new Date() });
        } catch (error: unknown) {
             const err = error as { message?: string; status?: number };
             if (err.message === 'Unauthorized' || err.status === 401) {
                handleLogout();
            } else {
                setSyncState({ status: 'error' });
            }
        }
    }, 2000); 

    return () => clearTimeout(timeoutId);
  }, [events, isAuthenticated, driveFileId, handleLogout, syncState.status, syncState.lastSynced]);

  return {
    isAuthenticated,
    driveFileId,
    syncState,
    googleClientId,
    setGoogleClientId,
    handleGoogleLogin,
    handleLogout,
    performFullSync
  };
}