import { useState, useEffect, useCallback, useMemo } from 'react';
import type { DailyRecord, SyncState } from '../types';
import { mergeEvents, saveLocalEvents } from '../services/storageService';
import {
  getProvider,
  getAllProviders,
  getActiveProviderId,
  setActiveProviderId,
} from '../cloudStorage';
import type { ICloudStorageProvider } from '../cloudStorage';

export function eventsEqual(a: DailyRecord[], b: DailyRecord[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0 && b.length === 0) return true;

  const sortFn = (x: DailyRecord, y: DailyRecord) => x.date.localeCompare(y.date);
  const stringA = JSON.stringify([...a].sort(sortFn));
  const stringB = JSON.stringify([...b].sort(sortFn));

  return stringA === stringB;
}

interface UseCloudSyncProps {
  events: DailyRecord[];
  setEvents: React.Dispatch<React.SetStateAction<DailyRecord[]>>;
}

export function useCloudSync({ events, setEvents }: UseCloudSyncProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fileRef, setFileRef] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });
  const [isApiInitialized, setIsApiInitialized] = useState(false);
  const [activeProviderId, setActiveProviderIdState] = useState<string | null>(
    () => getActiveProviderId()
  );

  const provider: ICloudStorageProvider | undefined = useMemo(
    () => (activeProviderId ? getProvider(activeProviderId) : undefined),
    [activeProviderId]
  );

  const availableProviders = getAllProviders();

  // Parse callback token on mount (from OAuth redirect)
  useEffect(() => {
    if (!provider) return;
    provider.parseCallbackToken();
  }, [provider]);

  // Initialize provider SDK
  useEffect(() => {
    if (!provider) return;
    provider.initialize().then((success) => {
      if (success) setIsApiInitialized(true);
    });
  }, [provider]);

  const handleLogout = useCallback(async () => {
    if (provider) await provider.logout();
    setIsAuthenticated(false);
    setFileRef(null);
    setSyncState({ status: 'idle' });
  }, [provider]);

  // CORE SYNCHRONIZATION LOGIC
  const performFullSync = useCallback(
    async (ref: string) => {
      if (!ref || !provider) return;
      setSyncState({ status: 'syncing' });
      try {
        const remoteEvents = await provider.fetchData(ref);
        const localEvents = events;
        const merged = mergeEvents(localEvents, remoteEvents);

        const isLocalDifferent = !eventsEqual(merged, localEvents);
        if (isLocalDifferent) {
          setEvents(merged);
          saveLocalEvents(merged);
        }

        const isRemoteDifferent = !eventsEqual(merged, remoteEvents);
        if (isRemoteDifferent) {
          await provider.uploadData(ref, merged);
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
    },
    [events, setEvents, provider, handleLogout]
  );

  // Session restore after SDK is initialized
  useEffect(() => {
    if (!isApiInitialized || isAuthenticated || !provider) return;

    provider.restoreSession().then((token) => {
      if (token) {
        setTimeout(() => {
          setIsAuthenticated(true);
          provider
            .ensureFileExists()
            .then((ref) => {
              setFileRef(ref);
              performFullSync(ref);
            })
            .catch((err) => {
              console.error('Session restore failed', err);
              handleLogout();
            });
        }, 0);
      }
    });
  }, [isApiInitialized, isAuthenticated, provider, handleLogout, performFullSync]);

  const handleLogin = useCallback(
    async (providerId: string) => {
      setActiveProviderId(providerId);
      setActiveProviderIdState(providerId);
      const selectedProvider = getProvider(providerId);
      if (selectedProvider) {
        try {
          setSyncState({ status: 'syncing' });
          await selectedProvider.login();
        } catch (error: unknown) {
          setSyncState({ status: 'error' });
          setIsAuthenticated(false);
          const err = error as { message?: string };
          if (err?.message) alert(err.message);
        }
      }
    },
    []
  );

  // Trigger sync on window focus
  useEffect(() => {
    const onFocus = () => {
      if (isAuthenticated && fileRef && syncState.status !== 'syncing') {
        performFullSync(fileRef);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isAuthenticated, fileRef, syncState.status, performFullSync]);

  // Debounced auto-save
  useEffect(() => {
    if (!isAuthenticated || !fileRef || !provider) return;
    if (
      syncState.status === 'success' &&
      Date.now() - (syncState.lastSynced?.getTime() ?? 0) < 2000
    )
      return;

    const timeoutId = setTimeout(async () => {
      setSyncState({ status: 'syncing' });
      try {
        await provider.uploadData(fileRef, events);
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
  }, [events, isAuthenticated, fileRef, provider, handleLogout, syncState.status, syncState.lastSynced]);

  return {
    isAuthenticated,
    fileRef,
    syncState,
    activeProviderId,
    availableProviders,
    handleLogin,
    handleLogout,
    performFullSync,
  };
}
