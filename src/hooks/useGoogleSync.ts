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
        // Use current events passed to hook
        const localEvents = events; 
        const merged = mergeEvents(localEvents, remoteEvents);
        
        const isLocalDifferent = JSON.stringify(merged) !== JSON.stringify(localEvents);
        if (isLocalDifferent) {
             setEvents(merged);
             saveLocalEvents(merged);
        }

        const isRemoteDifferent = JSON.stringify(merged) !== JSON.stringify(remoteEvents);
        if (isRemoteDifferent) {
             await uploadDriveData(fileId, merged);
        }

        setSyncState({ status: 'success', lastSynced: new Date() });
    } catch (error: any) {
        if (error.message === 'Unauthorized' || error.status === 401) {
            handleLogout();
        } else {
            setSyncState({ status: 'error' });
        }
    }
  }, [events, setEvents, handleLogout]); // Depends on events

  // Token-based Session Restore
  useEffect(() => {
    if (isApiInitialized && !isAuthenticated) {
        try {
            const storedTokenStr = localStorage.getItem('LUNA_AUTH_TOKEN');
            if (storedTokenStr) {
                const token: GoogleToken = JSON.parse(storedTokenStr);
                const now = Date.now();
                
                if (token.expires_at && token.expires_at > now + 60000) {
                    restoreGapiSession(token);
                    setIsAuthenticated(true);
                    ensureDriveFileExists()
                        .then(id => {
                            setDriveFileId(id);
                            // We need to call performFullSync here, but we can't easily doing it 
                            // directly inside this effect if we want to use the latest 'events' 
                            // without adding 'events' to dependency array which might cause loops.
                            // However, in the original code, it called performFullSync(id).
                            // The original code had 'performFullSync' dependent on 'events'.
                            // The original 'useEffect' for token restore depended only on [isApiInitialized].
                            // This implies 'performFullSync' was using a closure or 'events' state was empty initially.
                            
                            // To be safe, we will call it. If events are empty, it merges remote into empty.
                            performFullSync(id); 
                        })
                        .catch(() => {
                            handleLogout();
                        });
                } else {
                    localStorage.removeItem('LUNA_AUTH_TOKEN');
                    setIsAuthenticated(false);
                    setSyncState({ status: 'idle' });
                }
            }
        } catch (e) {
            localStorage.removeItem('LUNA_AUTH_TOKEN');
        }
    }
  }, [isApiInitialized, handleLogout, performFullSync]); 
  // Added performFullSync to dependencies. Since performFullSync depends on events, 
  // this effect runs when events change if isApiInitialized is true and !isAuthenticated.
  // But wait, if !isAuthenticated is true, we run this. Once authenticated, we don't run this.
  // So it's safe.

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

    } catch (error: any) {
      setSyncState({ status: 'error' });
      setIsAuthenticated(false);
      localStorage.removeItem('LUNA_AUTH_TOKEN');
      let errorMessage = "Login failed.";
      if (error?.message) errorMessage = error.message;
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

    setSyncState({ status: 'syncing' });
    const timeoutId = setTimeout(async () => {
        try {
            await uploadDriveData(driveFileId, events);
            setSyncState({ status: 'success', lastSynced: new Date() });
        } catch (error: any) {
             if (error.message === 'Unauthorized' || error.status === 401) {
                handleLogout();
            } else {
                setSyncState({ status: 'error' });
            }
        }
    }, 2000); 

    return () => clearTimeout(timeoutId);
  }, [events, isAuthenticated, driveFileId, handleLogout]); 
  // Note: performFullSync isn't used here, but 'events' is.

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
