import type { ReactNode } from 'react';
import type { SportDisplayLayout as SportDisplayLayoutState } from '@shotclock/shared/types';
import ThreePanelSportLayout from './ThreePanelSportLayout';
import TwoPanelSportLayout from './TwoPanelSportLayout';

interface SportDisplayLayoutProps {
  layout: SportDisplayLayoutState;
  primaryResetSequence?: number;
  children: ReactNode;
}

export default function SportDisplayLayout({
  layout,
  primaryResetSequence,
  children,
}: SportDisplayLayoutProps) {
  if (layout.type === 'two-panel') {
    return (
      <TwoPanelSportLayout layout={layout}>
        {children}
      </TwoPanelSportLayout>
    );
  }

  return (
    <ThreePanelSportLayout
      layout={layout}
      primaryResetSequence={primaryResetSequence}
    >
      {children}
    </ThreePanelSportLayout>
  );
}

