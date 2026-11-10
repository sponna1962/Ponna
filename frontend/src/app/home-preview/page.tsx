'use client';

import HomeV2 from '../../components/HomeV2';
import { StudentMenu } from '../../components/StudentMenu';

// Preview of the Nov 2026 home redesign. The live home page (/) is unchanged
// until the owner approves this.
export default function Page() {
  return <HomeV2 menu={<StudentMenu iconColor="#0A2A5E" />} />;
}
