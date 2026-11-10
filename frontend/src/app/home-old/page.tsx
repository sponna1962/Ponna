'use client';

import HomeDesignPreview from '../../components/HomeDesignPreview';
import { StudentMenu } from '../../components/StudentMenu';

// The home page as it was before the Nov 2026 redesign, kept for comparison
// and as the fallback. Not linked from anywhere and not indexed.
export default function Page() {
  return <HomeDesignPreview menu={<StudentMenu iconColor="#0B3864" />} />;
}
