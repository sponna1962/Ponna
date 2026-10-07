import type { Metadata } from 'next';
import { PAGE_URL, SITE } from './guide-data';

const TITLE = 'TNPSC Group 4 அறிவிப்பு 2026: 6,574 காலியிடங்கள், தேதிகள், தகுதி, விண்ணப்பம் | PONNA.in';
const DESCRIPTION =
  'TNPSC Group 4 அறிவிப்பு 11/2026 முழு விவரம்: 6,574 காலிப்பணியிடங்கள், விண்ணப்பிக்கக் கடைசி நாள் 05.11.2026, தேர்வு 10.01.2027, வயது வரம்பு, கல்வித் தகுதி, பாடத்திட்டம், OTR, கட்டணம் – தமிழில்.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'TNPSC Group 4 notification 2026',
    'TNPSC Group 4 அறிவிப்பு 2026',
    'குரூப் 4 அறிவிப்பு 2026',
    'TNPSC Group 4 vacancies 2026',
    'TNPSC Group 4 6574 காலியிடங்கள்',
    'TNPSC Group 4 age limit',
    'TNPSC Group 4 வயது வரம்பு',
    'TNPSC Group 4 கல்வித் தகுதி',
    'TNPSC Group 4 exam date 2026',
    'TNPSC Group 4 last date',
    'TNPSC Group 4 syllabus',
    'TNPSC Group 4 apply online',
    'TNPSC OTR',
    'Notification 11/2026',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'article',
    locale: 'ta_IN',
    siteName: 'PONNA.in',
    url: SITE + PAGE_URL,
    title: 'TNPSC Group 4 அறிவிப்பு 2026 – முழுமையான வழிகாட்டி',
    description: DESCRIPTION,
    images: [{ url: SITE + '/logo.png' }],
  },
  twitter: {
    card: 'summary',
    title: 'TNPSC Group 4 அறிவிப்பு 2026 – முழுமையான வழிகாட்டி',
    description: DESCRIPTION,
  },
};

export default function NotificationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
