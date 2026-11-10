// TNPSC exams shown across the site (home "தேர்வுகள்" section, the top menu
// and the /exams/<slug> pages). `ready` exams are open for practice; the rest
// are announced as "விரைவில்" and nothing inside them is opened yet.
// Opening an exam later = flip `ready` here once its practice, Study Notes
// and Pass are set up in Admin.

export type ExamGroup = 'group' | 'technical';

export type Exam = {
  slug: string;
  name: string;        // short name used in menus and cards
  fullName: string;    // TNPSC's own name for the examination
  group: ExamGroup;
  ready: boolean;
  posts?: string;      // one line on the posts it recruits for
};

export const EXAM_GROUPS: { id: ExamGroup; title: string }[] = [
  { id: 'group', title: 'Group தேர்வுகள்' },
  { id: 'technical', title: 'தொழில்நுட்பப் பணித் தேர்வுகள்' },
];

export const EXAMS: Exam[] = [
  { slug: 'group-4', name: 'Group 4', fullName: 'Combined Civil Services Examination – IV', group: 'group', ready: true, posts: 'VAO, இளநிலை உதவியாளர், தட்டச்சர் உள்ளிட்ட பதவிகள்' },
  { slug: 'group-1', name: 'Group 1', fullName: 'Combined Civil Services Examination – I', group: 'group', ready: false, posts: 'துணை ஆட்சியர், DSP உள்ளிட்ட பதவிகள்' },
  { slug: 'group-1c', name: 'Group 1-C', fullName: 'Group I-C Services', group: 'group', ready: false, posts: 'மாவட்டக் கல்வி அலுவலர்' },
  { slug: 'group-2', name: 'Group 2 / 2A', fullName: 'Combined Civil Services Examination – II', group: 'group', ready: false, posts: 'நேர்முகத் தேர்வு உள்ள / இல்லாத பதவிகள்' },
  { slug: 'group-3', name: 'Group 3', fullName: 'Group III Services', group: 'group', ready: false },
  { slug: 'group-6', name: 'Group 6', fullName: 'Group VI Services', group: 'group', ready: false, posts: 'வனத் தொழில் பழகுநர்' },
  { slug: 'group-7', name: 'Group 7', fullName: 'Group VII Services', group: 'group', ready: false, posts: 'செயல் அலுவலர், இந்து சமய அறநிலையத் துறை' },
  { slug: 'group-8', name: 'Group 8', fullName: 'Group VIII Services', group: 'group', ready: false, posts: 'செயல் அலுவலர் நிலை-IV, இந்து சமய அறநிலையத் துறை' },
  { slug: 'cts-interview', name: 'Technical Services (Interview Posts)', fullName: 'Combined Technical Services Examination (Interview Posts)', group: 'technical', ready: false },
  { slug: 'cts-non-interview', name: 'Technical Services (Non-Interview Posts)', fullName: 'Combined Technical Services Examination (Non-Interview Posts)', group: 'technical', ready: false },
  { slug: 'cts-diploma-iti', name: 'Technical Services (Diploma / ITI Level)', fullName: 'Combined Technical Services Examination (Diploma / ITI Level)', group: 'technical', ready: false },
];

export const examHref = (e: Exam) => `/exams/${e.slug}`;
export const findExam = (slug: string) => EXAMS.find((e) => e.slug === slug);

// Group 4 practice subjects with the number of published questions in the
// question bank (both languages together), counted on 10 Nov 2026 and
// rounded down. Shown on the Group 4 page so a visitor can see what is inside
// before signing up. Update when large batches are added.
export type ExamSubject = { name: string; count: string };
export const GROUP4_SUBJECTS: ExamSubject[] = [
  { name: 'பொது அறிவியல்', count: '7,700+' },
  { name: 'தமிழ்', count: '7,700+' },
  { name: 'பொது ஆங்கிலம்', count: '4,900+' },
  { name: 'புவியியல்', count: '4,800+' },
  { name: 'திறனறிவு (Aptitude)', count: '3,000+' },
  { name: 'இந்திய ஆட்சியியல்', count: '2,900+' },
  { name: 'இந்தியப் பொருளாதாரம், தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்', count: '1,800+' },
  { name: 'காரணவியல் (Reasoning)', count: '1,200+' },
  { name: 'தமிழ்நாட்டின் வரலாறு, பண்பாடு, மரபு', count: '1,100+' },
  { name: 'இந்திய வரலாறு, பண்பாடு, தேசிய இயக்கம்', count: '900+' },
];
export const GROUP4_TOTAL = '36,000+';
