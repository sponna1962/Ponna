// TNPSC Group 4 2026 notification guide — static data (Oct 2026).
// Every fact below comes from the user's own guide (itself built from TNPSC
// Notification No. 11/2026, Advertisement No. 747, dated 06.10.2026). The
// long-form section HTML lives in src/content/g4-notification.json.

export const PAGE_URL = '/tnpsc-group-4/notification-2026';
export const SITE = 'https://www.ponna.in';

// Application deadline: 05.11.2026, 11.59 PM IST.
export const DEADLINE_ISO = '2026-11-05T23:59:00+05:30';

// Section ids (from the guide) grouped for the table of contents.
export const TOC_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'முக்கிய தகவல்', ids: ['dates', 'warning', 'posts'] },
  { title: 'தகுதிகள்', ids: ['qual', 'age', 'medical', 'tamil', 'pbd', 'dw', 'community', 'women', 'sports', 'ex'] },
  { title: 'தேர்வு & பாடத்திட்டம்', ids: ['exam', 'syllabus', 'ranking', 'priority'] },
  { title: 'விண்ணப்பிக்கும் முறை', ids: ['otr', 'apply', 'photo', 'fee', 'centres'] },
  { title: 'தேர்வு நாள்', ids: ['examday', 'banned', 'omr', 'scribe', 'penalty'] },
  { title: 'தேர்வுக்குப் பின்', ids: ['cases', 'cert', 'pstm', 'postexam', 'annexures', 'lists', 'contact'] },
  { title: 'இறுதிச் சரிபார்ப்பு', ids: ['eligibility', 'checklist', 'process', 'source', 'conclusion'] },
];

export const STATS: { value: string; label: string; href: string }[] = [
  { value: '6,574', label: 'காலிப்பணியிடங்கள் · 46 பணிகள்', href: '#posts' },
  { value: '05.11.2026', label: 'விண்ணப்பிக்கக் கடைசி நாள்', href: '#dates' },
  { value: '10.01.2027', label: 'எழுத்துத் தேர்வு', href: '#dates' },
  { value: '₹100', label: 'தேர்வுக் கட்டணம்', href: '#fee' },
  { value: '200 / 300', label: 'கேள்விகள் / மதிப்பெண்கள்', href: '#exam' },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: 'TNPSC Group 4 2026 அறிவிப்பு எப்போது வெளியானது?',
    a: 'தமிழ்நாடு அரசுப் பணியாளர் தேர்வாணையம் (TNPSC) Group 4 (Combined Civil Services Examination-IV) அறிவிப்பு எண் 11/2026 (Advertisement No. 747)-ஐ 06.10.2026 அன்று வெளியிட்டது. அன்றே ஆன்லைன் விண்ணப்பமும் தொடங்கியது.',
  },
  {
    q: 'Group 4 2026-ல் மொத்தம் எத்தனை காலிப்பணியிடங்கள்?',
    a: '46 பணிகளுக்கு மொத்தம் 6,574 காலிப்பணியிடங்கள் அறிவிக்கப்பட்டுள்ளன. இவை தற்காலிகமானவை; கலந்தாய்வு தொடங்குவதற்கு முன்பு மாற்றப்படலாம்.',
  },
  {
    q: 'Group 4 விண்ணப்பிக்கக் கடைசி தேதி என்ன?',
    a: 'ஆன்லைன் விண்ணப்பத்துக்கு கடைசி நாள் 05.11.2026 இரவு 11.59 மணி. திருத்தம் செய்யும் காலம் (Application Correction Window): 09.11.2026 காலை 12.01 மணி முதல் 11.11.2026 இரவு 11.59 மணி வரை.',
  },
  {
    q: 'Group 4 எழுத்துத் தேர்வு எப்போது நடைபெறும்?',
    a: 'எழுத்துத் தேர்வு 10.01.2027 அன்று காலை 9.30 மணி முதல் மதியம் 12.30 மணி வரை நடைபெறும்.',
  },
  {
    q: 'Group 4 தேர்வுக் கட்டணம் எவ்வளவு?',
    a: 'கட்டணச் சலுகை கோராதவர்களுக்குத் தேர்வுக் கட்டணம் ₹100. அதற்கு முன் OTR (One Time Registration) பதிவுக்கு ₹150 செலுத்த வேண்டும்; வெற்றிகரமான OTR பதிவு 5 ஆண்டுகள் செல்லுபடியாகும்.',
  },
  {
    q: 'Group 4-க்கு எங்கே, எப்படி விண்ணப்பிப்பது?',
    a: 'www.tnpscexams.in இணையதளத்தில் OTR பதிவு செய்து, Group 4 தேர்வுக்குத் தனியாக ஆன்லைன் விண்ணப்பம் சமர்ப்பிக்க வேண்டும். OTR என்பது எந்த ஒரு பணிக்கான விண்ணப்பமும் அல்ல. முழு நடைமுறையும் இந்தப் பக்கத்தின் விண்ணப்பப் பிரிவுகளில் உள்ளது.',
  },
  {
    q: 'Group 4 தேர்வு முறை என்ன?',
    a: 'மொத்தம் 200 கேள்விகள், 300 மதிப்பெண்கள், 3 மணி நேரம். Part A: Tamil Eligibility-cum-Scoring Test (100 கேள்விகள், 150 மதிப்பெண்கள்); Part B: General Studies (75 கேள்விகள்); Part C: Aptitude and Mental Ability (25 கேள்விகள்).',
  },
  {
    q: 'Group 4 வயது வரம்பு எவ்வளவு?',
    a: 'வயது 01.07.2026 நிலவரப்படி கணக்கிடப்படும். பணி மற்றும் சமூகப் பிரிவு வாரியாக வயது வரம்பு மாறுபடும்; அறிவிப்பின் முழு அட்டவணை இந்தப் பக்கத்தின் "வயது வரம்பு" பிரிவில் உள்ளது.',
  },
  {
    q: 'Group 4-ல் என்னென்ன பணிகள் உள்ளன?',
    a: 'Village Administrative Officer, Junior Assistant, Bill Collector, Revenue Assistant, Tax Collector உள்ளிட்ட 46 பணிகள் இந்த அறிவிப்பில் உள்ளன. பணி வாரியான காலியிடங்கள் மற்றும் Post Code இந்தப் பக்கத்தின் இரண்டாம் பிரிவில் உள்ளன.',
  },
];
