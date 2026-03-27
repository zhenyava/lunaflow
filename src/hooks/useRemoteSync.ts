import { useState, useEffect, useCallback } from 'react';
import type { DailyRecord, SyncState } from '../types';
import { mergeEvents, saveStoredEvents, parseAndMigrateData } from '../services/storageService';
import type { RemoteStorageProvider } from '../storageProviders/RemoteStorageProviderInterface';

export function eventsEqual(a: DailyRecord[], b: DailyRecord[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0 && b.length === 0) return true;

  // Sort by date to ensure order, then stringify for a deep comparison.
  const sortFn = (x: DailyRecord, y: DailyRecord) => x.date.localeCompare(y.date);
  const stringA = JSON.stringify([...a].sort(sortFn));
  const stringB = JSON.stringify([...b].sort(sortFn));

  return stringA === stringB;
}

interface UseRemoteSyncProps {
  events: DailyRecord[];
  setEvents: React.Dispatch<React.SetStateAction<DailyRecord[]>>;
  provider: RemoteStorageProvider;
  isOnline: boolean;
}

export function useRemoteSync({ events, setEvents, provider, isOnline }: UseRemoteSyncProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [remoteFileId, setRemoteFileId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });
  const [isApiInitialized, setIsApiInitialized] = useState(false);

  // Handle any provider-specific callback logic (e.g., parsing OAuth hash tokens)
  useEffect(() => {
    if (provider.handleCallback) {
      provider.handleCallback();
    }
  }, [provider]);

  // Init Storage Provider API
  useEffect(() => {
    provider.initialize((success) => {
      if (success) {
         setIsApiInitialized(true);
      }
    });
  }, [provider]);

  const handleLogout = useCallback(async () => {
      await provider.signOut();
      setIsAuthenticated(false);
      setRemoteFileId(null);
      setSyncState({ status: 'idle' });
  }, [provider]);

  // CORE SYNCHRONIZATION LOGIC
  const performFullSync = useCallback(async (fileId: string) => {
    if (!fileId) return;
    setSyncState({ status: 'syncing' });
    try {
        const rawRemoteData = await provider.fetchData(fileId);
        const { records: remoteEvents } = parseAndMigrateData(rawRemoteData);
        const localEvents = events; 
        const merged = mergeEvents(localEvents, remoteEvents);
        
        const isLocalDifferent = !eventsEqual(merged, localEvents);
        if (isLocalDifferent) {
             setEvents(merged);
             await saveStoredEvents(merged);
        }

        const isRemoteDifferent = !eventsEqual(merged, remoteEvents);
        if (isRemoteDifferent) {
             await provider.uploadData(fileId, merged);
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
  }, [events, setEvents, handleLogout, provider]);

  // Session Restore
  useEffect(() => {
    if (!isApiInitialized || isAuthenticated) return;

    if (provider.isAuthenticated()) {
        setTimeout(() => {
            setIsAuthenticated(true);
            provider.restoreSession()
                .then(id => {
                    if (id) {
                        setRemoteFileId(id);
                        performFullSync(id); 
                    } else {
                        handleLogout();
                    }
                })
                .catch((err) => {
                    console.error('Session restore failed', err);
                    handleLogout();
                });
        }, 0);
    }
  }, [isApiInitialized, isAuthenticated, handleLogout, performFullSync, provider]);

  const handleLogin = async () => {
    try {
      setSyncState({ status: 'syncing' });
      await provider.signIn();
    } catch (error: unknown) {
      setSyncState({ status: 'error' });
      setIsAuthenticated(false);
      let errorMessage = "Login failed.";
      const err = error as { message?: string };
      if (err?.message) errorMessage = err.message;
      alert(errorMessage);
    }
  };

  // Trigger Sync on Window Focus
  useEffect(() => {
      const onFocus = () => {
          if (isAuthenticated && remoteFileId && syncState.status !== 'syncing' && isOnline) {
              performFullSync(remoteFileId);
          }
      };
      window.addEventListener('focus', onFocus);
      return () => window.removeEventListener('focus', onFocus);
  }, [isAuthenticated, remoteFileId, syncState.status, performFullSync, isOnline]);

  // Debounced Auto-Save
  useEffect(() => {
    if (!isAuthenticated || !remoteFileId || !isOnline) return;
    if (syncState.status === 'success' && Date.now() - (syncState.lastSynced?.getTime() || 0) < 2000) return;

    const timeoutId = setTimeout(async () => {
        if (!isOnline) return;
        setSyncState({ status: 'syncing' });
        try {
            await provider.uploadData(remoteFileId, events);
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
  }, [events, isAuthenticated, remoteFileId, handleLogout, syncState.status, syncState.lastSynced, provider, isOnline]);

  return {
    isAuthenticated,
    remoteFileId,
    syncState,
    handleLogin,
    handleLogout,
    performFullSync,
    providerName: provider.name
  };
}
