'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { getDeviceId } from '../../lib/device-id';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Device = { id: string; deviceId: string; label: string | null; firstSeenAt: string; lastSeenAt: string };

export default function DevicesPage() {
  const { t } = useLanguage();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const thisDeviceId = getDeviceId();

  function load() {
    studentFetch('/students/me/devices')
      .then((r) => (r.ok ? r.json() : []))
      .then(setDevices)
      .catch(() => setDevices([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function removeDevice(deviceId: string) {
    setRemovingId(deviceId);
    await studentFetch(`/students/me/devices/${deviceId}`, { method: 'DELETE' });
    setRemovingId(null);
    load();
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A' }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>{t.devices.title}</h1>
      </div>

      <div style={{ padding: 16 }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderLeft: '4px solid #FFD22A', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: COLORS.inkMuted, lineHeight: 1.65, marginBottom: 16 }}>{t.devices.note}</div>

      {devices === null && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {devices?.map((d) => {
        const isThisDevice = d.deviceId === thisDeviceId;
        return (
          <div
            key={d.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: `1px solid ${isThisDevice ? COLORS.gold : COLORS.line}`,
              borderLeft: '4px solid #FFD22A',
              borderRadius: 8,
              padding: 14,
              marginBottom: 10,
              background: isThisDevice ? COLORS.field : COLORS.card,
            }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 2px' }}>
                {d.label ?? t.devices.unknownDevice} {isThisDevice && <span style={{ fontSize: 11, color: COLORS.gold, fontWeight: 700 }}>({t.devices.thisDevice})</span>}
              </p>
              <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: 0 }}>
                {t.devices.lastUsed}: {new Date(d.lastSeenAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => removeDevice(d.deviceId)}
              disabled={removingId === d.deviceId}
              style={{ padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${COLORS.bad}`, color: COLORS.bad, background: 'transparent', fontSize: 13, fontWeight: 700 }}
            >
              {removingId === d.deviceId ? '…' : t.devices.remove}
            </button>
          </div>
        );
      })}

      {devices?.length === 0 && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>{t.devices.none}</p>}
      </div>
    </main>
  );
}
