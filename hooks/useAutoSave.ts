import { useState, useEffect, useCallback, useRef } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * A custom hook to automatically save data to a persistent storage (e.g., localStorage).
 * It saves data on a regular interval and also when the data changes (with debouncing).
 * @param data The data to be saved. The hook tracks changes to this data.
 * @param onSave A callback function that performs the save operation. It should be stable (wrapped in useCallback).
 * @param interval The interval in milliseconds for periodic saving. Defaults to 2 minutes.
 */
export const useAutoSave = <T,>(
  data: T,
  onSave: (data: T) => Promise<void> | void,
  interval: number = 120000
) => {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  
  const debounceTimeoutRef = useRef<number | null>(null);
  const dataRef = useRef(data);
  const onSaveRef = useRef(onSave);
  const isMounted = useRef(false);

  // Keep refs updated to avoid stale closures in timers
  useEffect(() => {
    dataRef.current = data;
    onSaveRef.current = onSave;
  });

  // The core save function
  const performSave = useCallback(async () => {
    // Prevent saving if there's nothing to save, which can be determined by the specific component's logic within onSave
    setStatus('saving');
    try {
      await onSaveRef.current(dataRef.current);
      setStatus('saved');
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (error) {
      console.error('Auto-save failed:', error);
      setStatus('error');
    }
  }, []);

  // Effect for saving on data change (debounced)
  useEffect(() => {
    // Don't save on initial mount
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      performSave();
    }, 2500); // 2.5-second debounce after a change

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [data, performSave]);

  // Effect for interval-based saving
  useEffect(() => {
    const intervalId = setInterval(performSave, interval);
    return () => clearInterval(intervalId);
  }, [performSave, interval]);

  return { status, lastSaved };
};
