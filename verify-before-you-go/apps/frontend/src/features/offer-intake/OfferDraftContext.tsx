import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { AnalyseOfferResponse } from '@vbyg/contracts';

import { createEmptyOfferDraft, type OfferDraft } from './model';

interface OfferDraftContextValue {
  draft: OfferDraft;
  setDraft: Dispatch<SetStateAction<OfferDraft>>;
  resetDraft: () => void;
  recentSaveNotice?: string;
  setRecentSaveNotice: (notice?: string) => void;
  analysis?: AnalyseOfferResponse;
  setAnalysis: (analysis?: AnalyseOfferResponse) => void;
}

const OfferDraftContext = createContext<OfferDraftContextValue | undefined>(undefined);

export function OfferDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OfferDraft>(createEmptyOfferDraft);
  const [recentSaveNotice, setRecentSaveNotice] = useState<string>();
  const [analysis, setAnalysis] = useState<AnalyseOfferResponse>();
  const value = useMemo(
    () => ({
      draft,
      setDraft,
      resetDraft: () => {
        setDraft(createEmptyOfferDraft());
        setRecentSaveNotice(undefined);
        setAnalysis(undefined);
      },
      recentSaveNotice,
      setRecentSaveNotice,
      analysis,
      setAnalysis,
    }),
    [analysis, draft, recentSaveNotice],
  );

  return <OfferDraftContext.Provider value={value}>{children}</OfferDraftContext.Provider>;
}

export function useOfferDraft(): OfferDraftContextValue {
  const value = useContext(OfferDraftContext);
  if (!value) throw new Error('useOfferDraft must be used inside OfferDraftProvider.');
  return value;
}
