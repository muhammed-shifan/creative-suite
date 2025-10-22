import { useState, useCallback } from 'react';

export const useHistory = <T>(initialState: T, options?: { limit?: number }) => {
  const { limit = Infinity } = options || {};
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const state = history[currentIndex];

  const setState = useCallback((newState: T | ((prevState: T) => T)) => {
    const resolvedState = typeof newState === 'function' 
      ? (newState as (prevState: T) => T)(state) 
      : newState;

    if (JSON.stringify(resolvedState) === JSON.stringify(state)) {
        return;
    }

    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(resolvedState);
    
    while (newHistory.length > limit) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [currentIndex, history, state, limit]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, history.length]);

  const reset = useCallback((newState: T) => {
      setHistory([newState]);
      setCurrentIndex(0);
  }, []);
  
  const loadHistory = useCallback((newHistory: T[], newIndex: number) => {
    if (newHistory && newHistory.length > 0 && newIndex >= 0 && newIndex < newHistory.length) {
        setHistory(newHistory);
        setCurrentIndex(newIndex);
    }
  }, []);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return { state, setState, undo, redo, reset, canUndo, canRedo, history, currentIndex, loadHistory };
};
