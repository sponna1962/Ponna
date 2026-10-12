import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNPSC Group 4 Cut-off Predictor — Check Your Chances | PONNA.in',
  description:
    'Predict your TNPSC Group 4 cut-off based on community-verified previous cut-off marks and your own practice accuracy. Free cut-off estimator for Tamil Nadu exam aspirants.',
  alternates: { canonical: '/cutoff-predictor' },
};

export default function CutoffPredictorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
