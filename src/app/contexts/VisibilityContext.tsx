import React, { createContext, useContext, useState, useCallback } from 'react';

interface VisibilityContextValue {
  amountsVisible: boolean;
  toggleAmounts: () => void;
  maskAmount: (formatted: string) => string;
}

const VisibilityContext = createContext<VisibilityContextValue>({
  amountsVisible: true,
  toggleAmounts: () => {},
  maskAmount: (f) => f,
});

export function VisibilityProvider({ children }: { children: React.ReactNode }) {
  const [amountsVisible, setAmountsVisible] = useState<boolean>(() => {
    return localStorage.getItem('amountsVisible') !== 'false';
  });

  const toggleAmounts = useCallback(() => {
    setAmountsVisible(prev => {
      const next = !prev;
      localStorage.setItem('amountsVisible', String(next));
      return next;
    });
  }, []);

  const maskAmount = useCallback(
    (formatted: string) => (amountsVisible ? formatted : '••••••'),
    [amountsVisible]
  );

  return (
    <VisibilityContext.Provider value={{ amountsVisible, toggleAmounts, maskAmount }}>
      {children}
    </VisibilityContext.Provider>
  );
}

export function useVisibility() {
  return useContext(VisibilityContext);
}
