import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { RewardEligibility } from './reward-model';

type RewardContextValue = {
  clearEligibility: (source?: RewardEligibility) => void;
  eligibility?: RewardEligibility;
  unlock: (source: RewardEligibility) => void;
};

const RewardContext = createContext<RewardContextValue | null>(null);

export function RewardProvider({
  children,
  initialEligibility,
}: {
  children: ReactNode;
  initialEligibility?: RewardEligibility;
}) {
  const [eligibility, setEligibility] = useState<RewardEligibility | undefined>(initialEligibility);
  const unlock = useCallback((source: RewardEligibility) => setEligibility(source), []);
  const clearEligibility = useCallback((source?: RewardEligibility) => {
    setEligibility((current) => !source || current === source ? undefined : current);
  }, []);
  const value = useMemo(() => ({ clearEligibility, eligibility, unlock }), [clearEligibility, eligibility, unlock]);

  return <RewardContext.Provider value={value}>{children}</RewardContext.Provider>;
}

export function useReward() {
  const context = useContext(RewardContext);
  if (!context) throw new Error('useReward must be used within RewardProvider');
  return context;
}
