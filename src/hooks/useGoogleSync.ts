import { useState, useEffect, useCallback } from 'react';
import type { DailyRecord, GoogleToken, SyncState } from '../types';
import { 
  initializeGoogleApi, 
  signInToGoogle, 
  ensureDriveFileExists, 
  uploadDriveData, 
  fetchDriveDataContent,
  revokeToken,
  restoreGapiSession,
  getSharedDriveFile
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
  const [isSharedFileReadOnly, setIsSharedFileReadOnly] = useState(false);
  const [isSharedFile, setIsSharedFile] = useState(false);
  
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
    initializeGoogleApi((success) => {
      if (success) {
         setIsApiInitialized(true);
      }
    });
  }, []);

  const handleLogout = useCallback(async () => {
      await revokeToken();
      setIsAuthenticated(false);
      setDriveFileId(null);
      setSyncState({ status: 'idle' });
      setIsSharedFileReadOnly(false);
      setIsSharedFile(false);
  }, []);

  // CORE SYNCHRONIZATION LOGIC
  const performFullSync = useCallback(async (fileId: string, isReadOnly: boolean = false) => {
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
        if (isRemoteDifferent && !isReadOnly) {
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
            restoreGapiSession(token);
            setTimeout(async () => {
                setIsAuthenticated(true);
                
                try {
                    const sharedId = localStorage.getItem('LUNA_SHARED_FILE_ID');
                    let targetFileId = null;
                    let isReadOnly = false;
                    
                    if (sharedId) {
                        try {
                            const sharedFile = await getSharedDriveFile(sharedId);
                            targetFileId = sharedFile.id;
                            isReadOnly = !sharedFile.canEdit;
                            setIsSharedFileReadOnly(isReadOnly);
                            setIsSharedFile(true);
                        } catch (err) {
                            console.warn("Could not access shared file, falling back to personal", err);
                            localStorage.removeItem('LUNA_SHARED_FILE_ID');
                            setIsSharedFile(false);
                        }
                    }
                    
                    if (!targetFileId) {
                        targetFileId = await ensureDriveFileExists();
                        setIsSharedFileReadOnly(false);
                        setIsSharedFile(false);
                        isReadOnly = false;
                    }
                    
                    setDriveFileId(targetFileId);
                    performFullSync(targetFileId, isReadOnly); 
                } catch(err) {
                    console.error('Session restore logic failed', err);
                    handleLogout();
                }
            }, 0);
        }
    } catch {
        localStorage.removeItem('LUNA_AUTH_TOKEN');
    }
  }, [isApiInitialized, isAuthenticated, handleLogout, performFullSync]);

  const handleGoogleLogin = async () => {
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

  const connectSharedFile = async (linkOrId: string) => {
      // Extract ID from full link or just use the ID
      const match = linkOrId.match(/[-\w]{25,}/);
      const extractedId = match ? match[0] : linkOrId.trim();
      
      if (!extractedId) {
          alert("Invalid link or File ID.");
          return;
      }
      
      localStorage.setItem('LUNA_SHARED_FILE_ID', extractedId);
      
      if (!isAuthenticated) {
          await handleGoogleLogin();
          return; // will redirect
      }
      
      // If already authenticated, switch context immediately
      try {
          setSyncState({ status: 'syncing' });
          const sharedFile = await getSharedDriveFile(extractedId);
          setDriveFileId(sharedFile.id);
          setIsSharedFileReadOnly(!sharedFile.canEdit);
          setIsSharedFile(true);
          performFullSync(sharedFile.id, !sharedFile.canEdit);
          alert("Successfully connected to shared file!");
      } catch (err) {
          console.error("Failed to connect to shared file", err);
          alert("Could not access the shared file. Ensure you have permission.");
          setSyncState({ status: 'error' });
          localStorage.removeItem('LUNA_SHARED_FILE_ID');
          setIsSharedFile(false);
      }
  };

  const disconnectSharedFile = () => {
      localStorage.removeItem('LUNA_SHARED_FILE_ID');
      setIsSharedFile(false);
      setIsSharedFileReadOnly(false);
      setDriveFileId(null);
      // Trigger a reload to re-initialize with the personal file
      window.location.reload();
  };

  // Trigger Sync on Window Focus
  useEffect(() => {
      const onFocus = () => {
          if (isAuthenticated && driveFileId && syncState.status !== 'syncing') {
              performFullSync(driveFileId, isSharedFileReadOnly);
          }
      };
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
  }, [isAuthenticated, driveFileId, syncState.status, performFullSync, isSharedFileReadOnly]);

  // Debounced Auto-Save
  useEffect(() => {
    if (!isAuthenticated || !driveFileId || isSharedFileReadOnly) return;
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
  }, [events, isAuthenticated, driveFileId, handleLogout, syncState.status, syncState.lastSynced, isSharedFileReadOnly]);

  return {
    isAuthenticated,
    driveFileId,
    syncState,
    googleClientId,
    setGoogleClientId,
    handleGoogleLogin,
    handleLogout,
    performFullSync,
    connectSharedFile,
    disconnectSharedFile,
    isSharedFile,
    isSharedFileReadOnly
  };
}
