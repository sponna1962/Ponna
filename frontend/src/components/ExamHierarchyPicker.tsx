'use client';

// Exam Hierarchy Picker (finalized requirement) — a simple, single-path
// drill-down (Purpose -> Authority -> Category -> Sub-Category), reused
// by Cut-off Predictor and Live Exam so both follow the same
// Authority-first structure as Start Practice, rather than a flat
// Sub-Category dropdown. Deliberately NOT the multi-select "All
// Categories" picker built for Start Practice -- this always resolves to
// exactly ONE final Sub-Category, which is all Cut-off/Live Exam need.
//
// A level with only one option auto-selects and advances immediately --
// today that means Purpose and Authority (only TNPSC is student-visible)
// both skip straight through, so this feels like a single Category ->
// Sub-Category pick right now, while staying correctly hierarchical the
// moment a second Authority/Purpose is ever added.

import { useEffect, useState } from 'react';
import { studentFetch } from '../lib/student-fetch';
import { COLORS } from '../lib/brand-theme';

type SubCategory = { id: string; name: string; _count: { questions: number } };
type Category = { id: string; name: string; subCategories: SubCategory[] };
type Authority = { id: string; name: string; categories: Category[] };
type Purpose = { id: string; name: string; authorities: Authority[] };

type Level = 'purpose' | 'authority' | 'category' | 'subCategory';

export function ExamHierarchyPicker({
  onSelect,
  selectedName,
}: {
  onSelect: (subCategoryId: string, subCategoryName: string) => void;
  selectedName?: string | null;
}) {
  const [tree, setTree] = useState<Purpose[] | null>(null);
  const [level, setLevel] = useState<Level>('purpose');
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [authority, setAuthority] = useState<Authority | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  useEffect(() => {
    studentFetch('/exam-taxonomy')
      .then((r) => r.json())
      .then((data: Purpose[]) => {
        setTree(data);
        autoAdvance(data, 'purpose', null, null, null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Auto-selects and advances past any level that has exactly one
   * option, so the common today's-reality case (one Purpose, one
   * Authority) never makes the student click through empty choices. */
  function autoAdvance(data: Purpose[], atLevel: Level, p: Purpose | null, a: Authority | null, c: Category | null) {
    if (atLevel === 'purpose') {
      if (data.length === 1) {
        setPurpose(data[0]);
        autoAdvance(data, 'authority', data[0], null, null);
        return;
      }
      setLevel('purpose');
      return;
    }
    if (atLevel === 'authority' && p) {
      if (p.authorities.length === 1) {
        setAuthority(p.authorities[0]);
        autoAdvance(data, 'category', p, p.authorities[0], null);
        return;
      }
      setLevel('authority');
      return;
    }
    if (atLevel === 'category' && a) {
      if (a.categories.length === 1) {
        setCategory(a.categories[0]);
        autoAdvance(data, 'subCategory', p, a, a.categories[0]);
        return;
      }
      setLevel('category');
      return;
    }
    if (atLevel === 'subCategory' && c) {
      setLevel('subCategory');
    }
  }

  function pickPurpose(p: Purpose) {
    setPurpose(p);
    setAuthority(null);
    setCategory(null);
    if (tree) autoAdvance(tree, 'authority', p, null, null);
  }

  function pickAuthority(a: Authority) {
    setAuthority(a);
    setCategory(null);
    if (tree) autoAdvance(tree, 'category', purpose, a, null);
  }

  function pickCategory(c: Category) {
    setCategory(c);
    if (tree) autoAdvance(tree, 'subCategory', purpose, authority, c);
  }

  function pickSubCategory(sc: SubCategory) {
    onSelect(sc.id, sc.name);
  }

  if (!tree) return <p style={{ fontSize: 13, color: COLORS.inkMuted }}>…</p>;

  // Already resolved to a final selection elsewhere (parent tracks it) —
  // show a compact "change" link instead of the whole picker again.
  if (selectedName) {
    return (
      <button
        onClick={() => {
          setPurpose(null);
          setAuthority(null);
          setCategory(null);
          autoAdvance(tree, 'purpose', null, null, null);
        }}
        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', fontSize: 13, color: COLORS.ink, textDecoration: 'underline', cursor: 'pointer' }}
      >
        {selectedName} ({'மாற்ற'})
      </button>
    );
  }

  const chipRow = (items: { id: string; name: string }[], onPick: (item: any) => void, all: any[]) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onPick(all.find((x) => x.id === item.id))}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            border: `1px solid ${COLORS.line}`,
            background: COLORS.paper,
            color: COLORS.ink,
            fontSize: 13,
          }}
        >
          {item.name}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {level === 'purpose' && chipRow(tree, pickPurpose, tree)}
      {level === 'authority' && purpose && chipRow(purpose.authorities, pickAuthority, purpose.authorities)}
      {level === 'category' && authority && chipRow(authority.categories, pickCategory, authority.categories)}
      {level === 'subCategory' && category && chipRow(category.subCategories, pickSubCategory, category.subCategories)}
    </div>
  );
}
