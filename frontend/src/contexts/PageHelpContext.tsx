import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface PageHelpContextType {
  activeKey: string | null;
  open: (key: string) => void;
  close: () => void;
  replayOnboarding: () => void;
}

const PageHelpContext = createContext<PageHelpContextType | null>(null);

export const ONBOARDING_FLAG = 'nomation_onboarding_v2_completed';
export const ONBOARDING_REPLAY_EVENT = 'nomation:onboarding-replay';

export function PageHelpProvider({ children }: { children: React.ReactNode }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const open = useCallback((key: string) => setActiveKey(key), []);
  const close = useCallback(() => setActiveKey(null), []);

  // Replaying onboarding clears the localStorage flag and dispatches a window
  // event. DashboardPage listens and reopens the tour next time it mounts.
  const replayOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_FLAG);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(ONBOARDING_REPLAY_EVENT));
    setActiveKey(null);
  }, []);

  useEffect(() => {
    if (!activeKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeKey, close]);

  const value = useMemo(
    () => ({ activeKey, open, close, replayOnboarding }),
    [activeKey, open, close, replayOnboarding],
  );

  return <PageHelpContext.Provider value={value}>{children}</PageHelpContext.Provider>;
}

export function usePageHelp(): PageHelpContextType {
  const ctx = useContext(PageHelpContext);
  if (!ctx) throw new Error('usePageHelp must be used inside <PageHelpProvider>');
  return ctx;
}
