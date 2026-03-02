import { useState, useEffect, useCallback } from 'react';
import type { CalendarEvent, GoogleToken, SyncState } from '../types';
import { 
  initializeGoogleApi, 
  signInToGoogle, 
  ensureDriveFileExists, 
  uploadDriveData, 
  fetchDriveDataContent,
  revokeToken,
  restoreGapiSession
} from '../services/googleService';
import { mergeEvents, saveLocalEvents } from '../services/storageService';
import { GOOGLE_CLIENT_ID } from '../constants';

function eventsEqual(a: CalendarEvent[], b: CalendarEvent[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const eventA = a[i];
    const eventB = b[i];

    const keysA = Object.keys(eventA) as (keyof CalendarEvent)[];
    const keysB = Object.keys(eventB) as (keyof CalendarEvent)[];

    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (eventA[key] !== eventB[key]) return false;
    }
  }
  return true;
}

interface UseGoogleSyncProps {
  events: CalendarEvent[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
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

  // Init Google API
  useEffect(() => {
    if (googleClientId) {
      initializeGoogleApi(googleClientId, (success) => {
        if (success) {
           console.log("Google API Initialized");
           setIsApiInitialized(true);
        }
      });
    }
  }, [googleClientId]);

  const handleLogout = useCallback(() => {
      revokeToken();
      setIsAuthenticated(false);
      setDriveFileId(null);
      setSyncState({ status: 'idle' });
      localStorage.removeItem('LUNA_AUTH_TOKEN');
  }, []);

  // CORE SYNCHRONIZATION LOGIC
  const performFullSync = useCallback(async (fileId: string) => {
    if (!fileId) return;
    setSyncState({ status: 'syncing' });
    try {
        const remoteEvents = await fetchDriveDataContent(fileId);
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
            const now = Date.now();
            
            if (token.expires_at && token.expires_at > now + 60000) {
                restoreGapiSession(token);
                setTimeout(() => {
                    setIsAuthenticated(true);
                    ensureDriveFileExists()
                        .then(id => {
                            setDriveFileId(id);
                            performFullSync(id); 
                        })
                        .catch(() => {
                            handleLogout();
                        });
                }, 0);
            } else {
                localStorage.removeItem('LUNA_AUTH_TOKEN');
                setTimeout(() => {
                    setIsAuthenticated(false);
                    setSyncState({ status: 'idle' });
                }, 0);
            }
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
      const tokenResponse = await signInToGoogle(true);
      if (tokenResponse && tokenResponse.expires_in) {
          const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
          const tokenToStore: GoogleToken = { ...tokenResponse, expires_at: expiresAt };
          localStorage.setItem('LUNA_AUTH_TOKEN', JSON.stringify(tokenToStore));
      }
      const fileId = await ensureDriveFileExists();
      setDriveFileId(fileId);
      setIsAuthenticated(true);
      await performFullSync(fileId);

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
