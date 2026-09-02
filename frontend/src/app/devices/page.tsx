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
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.devices.title}</h1>
      </div>

      <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 20, lineHeight: 1.6 }}>{t.devices.note}</p>

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
              borderRadius: 12,
              padding: 14,
              marginBottom: 10,
              background: isThisDevice ? COLORS.goldLight : 'transparent',
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
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #dc2626', color: '#dc2626', background: '#fff', fontSize: 12 }}
            >
              {removingId === d.deviceId ? '…' : t.devices.remove}
            </button>
          </div>
        );
      })}

      {devices?.length === 0 && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>{t.devices.none}</p>}
    </main>
  );
}
