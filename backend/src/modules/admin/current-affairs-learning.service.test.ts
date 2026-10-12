// Tests for recovering a Gemini response that was cut off by the token limit.
jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { salvageTruncatedJson } from './current-affairs-learning.service';

describe('salvageTruncatedJson', () => {
  it('keeps the complete events of a response cut off mid-event', () => {
    const raw = '```json\n{"events":[{"category":"இந்தியா","headline":"ஒன்று","facts":["a","b"]},{"category":"உலகம்","headline":"இரண்டு","facts":["c"]},{"category":"தமிழ்நாடு","headline":"மூன்று","fa';
    const out = JSON.parse(salvageTruncatedJson(raw)!);
    expect(out.events).toHaveLength(2);
    expect(out.events[1].headline).toBe('இரண்டு');
  });

  it('is not fooled by braces and quotes inside strings', () => {
    const raw = '{"verifiedEvents":[{"headline":"A } tricky \\"one\\" ]","facts":["x"]},{"headline":"cut';
    const out = JSON.parse(salvageTruncatedJson(raw)!);
    expect(out.verifiedEvents).toHaveLength(1);
    expect(out.verifiedEvents[0].headline).toBe('A } tricky "one" ]');
  });

  it('returns null when no complete event exists', () => {
    expect(salvageTruncatedJson('{"events":[{"category":"இந்தியா","headl')).toBeNull();
    expect(salvageTruncatedJson('no json here')).toBeNull();
  });
});
