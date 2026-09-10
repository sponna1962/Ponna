// Offline Practice — IndexedDB storage (Sept 2026, dedicated phase).
// Native IndexedDB, no external library — one object store holding the
// single currently-active pack (packId, questions with full content
// including answers, and the student's own locally-recorded answers).
// Deliberately supports only ONE active pack at a time, matching the
// backend design (download one 50-question pack, practice, sync,
// download the next) — keeps this genuinely simple rather than a full
// offline-multi-pack sync engine.

const DB_NAME = 'ponna-offline';
const DB_VERSION = 1;
const STORE = 'pack';
const PACK_KEY = 'current';

export interface OfflineQuestion {
  id: string;
  sequenceNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanationTa: string | null;
  explanationEn: string | null;
  language: string;
  difficulty: string | null;
}

export interface OfflineAnswer {
  questionId: string;
  selectedOption: 'A' | 'B' | 'C' | 'D';
  answeredAt: string; // ISO, recorded the moment the student answers — this is what streak backfill uses
}

export interface OfflinePackData {
  packId: string;
  questions: OfflineQuestion[];
  answers: OfflineAnswer[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflinePack(data: OfflinePackData): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, PACK_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflinePack(): Promise<OfflinePackData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(PACK_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function recordOfflineAnswer(questionId: string, selectedOption: 'A' | 'B' | 'C' | 'D'): Promise<void> {
  const pack = await getOfflinePack();
  if (!pack) return;
  if (pack.answers.some((a) => a.questionId === questionId)) return; // already answered, no-repeat within the pack
  pack.answers.push({ questionId, selectedOption, answeredAt: new Date().toISOString() });
  await saveOfflinePack(pack);
}

export async function clearOfflinePack(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(PACK_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
