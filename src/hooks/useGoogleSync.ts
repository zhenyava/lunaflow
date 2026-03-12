import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/react';
import type { DailyRecord, SyncState } from '../types';
import { 
  ensureDriveFileExists, 
  uploadDriveData, 
  fetchDriveDataContent,
  getValidAccessToken,
  revokeToken
} from '../services/googleService';
import { mergeEvents, saveLocalEvents, parseAndMigrateData } from '../services/storageService';

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
  const { isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const [driveFileId, setDriveFileId] = useState<string | null>(localStorage.getItem('LUNA_DRIVE_FILE_ID'));
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });
  const isSyncingRef = useRef(false);

  const handleLogin = async () => {
    try {
      // @ts-ignore - Clerk v5 authenticateWithRedirect exists on LoadedClerk
      await clerk.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/calendar',
        redirectUrlComplete: '/calendar',
      });
    } catch (error) {
      console.error("Clerk login error", error);
      alert("Failed to initiate login with Google.");
    }
  };

  const handleLogout = useCallback(async () => {
      await signOut();
      revokeToken();
      setDriveFileId(null);
      setSyncState({ status: 'idle' });
      localStorage.removeItem('LUNA_DRIVE_FILE_ID');
      localStorage.removeItem('LUNA_DRIVE_CONNECTED');
  }, [signOut]);

  // CORE SYNCHRONIZATION LOGIC
  const performFullSync = useCallback(async (fileId: string) => {
    if (!fileId || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncState({ status: 'syncing' });
    
    try {
        const googleToken = await getValidAccessToken(getToken);
        const rawRemoteData = await fetchDriveDataContent(fileId, googleToken);
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
             await uploadDriveData(fileId, merged, googleToken);
        }

        setSyncState({ status: 'success', lastSynced: new Date() });
    } catch (error: unknown) {
        console.error("Sync Error:", error);
        const err = error as { message?: string; status?: number };
        if (err.message === 'Unauthorized' || err.status === 401) {
            setSyncState({ status: 'error' });
            // Let Clerk handle session expiration or refresh
        } else {
            setSyncState({ status: 'error' });
        }
    } finally {
        isSyncingRef.current = false;
    }
  }, [events, setEvents, getToken]);

  // Initial Sync when signed in or when driveFileId changes
  useEffect(() => {
    if (isSignedIn && !driveFileId && syncState.status === 'idle') {
        const initDrive = async () => {
            try {
                setSyncState({ status: 'syncing' });
                const googleToken = await getValidAccessToken(getToken);
                const id = await ensureDriveFileExists(googleToken);
                setDriveFileId(id);
                localStorage.setItem('LUNA_DRIVE_FILE_ID', id);
                localStorage.setItem('LUNA_DRIVE_CONNECTED', 'true');
                await performFullSync(id);
            } catch (e) {
                console.error("Drive Init Error", e);
                setSyncState({ status: 'error' });
            }
        };
        initDrive();
    } else if (isSignedIn && driveFileId && syncState.status === 'idle') {
        performFullSync(driveFileId);
    }
  }, [isSignedIn, driveFileId, getToken, performFullSync, syncState.status]);

  // Trigger Sync on Window Focus
  useEffect(() => {
      const onFocus = () => {
          if (isSignedIn && driveFileId && syncState.status !== 'syncing') {
              performFullSync(driveFileId);
          }
      };
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
  }, [isSignedIn, driveFileId, syncState.status, performFullSync]);

  // Debounced Auto-Save
  useEffect(() => {
    if (!isSignedIn || !driveFileId) return;
    
    // Don't save if we just synced successfully in the last 2 seconds
    if (syncState.status === 'success' && Date.now() - (syncState.lastSynced?.getTime() || 0) < 2000) return;

    const timeoutId = setTimeout(async () => {
        if (isSyncingRef.current) return;
        setSyncState({ status: 'syncing' });
        try {
            const googleToken = await getValidAccessToken(getToken);
            await uploadDriveData(driveFileId, events, googleToken);
            setSyncState({ status: 'success', lastSynced: new Date() });
        } catch (error: unknown) {
             console.error("Auto-save error", error);
             const err = error as { message?: string; status?: number };
             if (err.message === 'Unauthorized' || err.status === 401) {
                setSyncState({ status: 'error' });
            } else {
                setSyncState({ status: 'error' });
            }
        }
    }, 3000); 

    return () => clearTimeout(timeoutId);
  }, [events, isSignedIn, driveFileId, getToken, syncState.status, syncState.lastSynced]);

  return {
    isAuthenticated: isSignedIn,
    user,
    driveFileId,
    syncState,
    handleLogin,
    handleLogout,
    performFullSync
  };
}
