'use client';

import React, { useMemo, useState } from 'react';
import { Thermometer, RotateCcw, AlertTriangle, Target, Gauge } from 'lucide-react';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const zoneMeta = [
  { key: 'z1', label: 'Z1', area: 'Neck / Upper shoulder' },
  { key: 'z2', label: 'Z2', area: 'Shoulder' },
  { key: 'z3', label: 'Z3', area: 'Upper body' },
  { key: 'z4', label: 'Z4', area: 'Lower body' },
  { key: 'z5', label: 'Z5', area: 'Base' },
];

const defaultZones = { z1: 104, z2: 108, z3: 110, z4: 107, z5: 103 };

function tempToColor(temp, min = 95, max = 120) {
  const ratio = clamp((temp - min) / (max - min), 0, 1);
  const hue = 220 - ratio * 220;
  return `hsl(${hue}, 90%, 55%)`;
}

function computeSimulation({ z1, z2, z3, z4, z5, primaryBlow, secondaryBlow, stretchBias }) {
  const shoulderHeat = z1 * 0.35 + z2 * 0.65;
  const upperBodyHeat = z2 * 0.3 + z3 * 0.7;
  const lowerBodyHeat = z3 * 0.25 + z4 * 0.75;
  const baseHeat = z4 * 0.35 + z5 * 0.65;

  const shoulderSoft = shoulderHeat - 106;
  const upperBodySoft = upperBodyHeat - 108;
  const lowerBodySoft = lowerBodyHeat - 107;
  const baseSoft = baseHeat - 104;

  const shoulderFlow = shoulderSoft * 0.9 + primaryBlow * 0.22 + stretchBias * 0.35;
  const bodyFlow = ((upperBodySoft + lowerBodySoft) / 2) * 0.95 + secondaryBlow * 0.16 + stretchBias * 0.18;
  const baseFlow = baseSoft * 1.05 + secondaryBlow * 0.25 - stretchBias * 0.14;

  const shoulderThickness = clamp(100 - shoulderFlow * 2.0 + (z3 - z2) * 0.5, 72, 128);
  const upperBodyThickness = clamp(100 - bodyFlow * 1.5 + (z4 - z3) * 0.2, 72, 128);
  const lowerBodyThickness = clamp(100 - (bodyFlow * 1.1 + baseFlow * 0.25), 72, 128);
  const baseThickness = clamp(100 - baseFlow * 2.2 + (z4 - z5) * 0.4, 72, 130);

  const defects = [];
  const actions = [];

  if (z1 > 111 || shoulderHeat > 110.5) {
    defects.push({ name: 'คอ/ไหล่ร้อนเกิน', severity: 'high', reason: 'ช่วง Z1-Z2 soft เกิน ทำให้ stretch เร็วเกินช่วงต้น' });
    actions.push('ลด Z1 ก่อน 1°C แล้วรอดูผล');
    actions.push('ถ้ายังไม่หาย ลด Z2 อีก 1°C');
  }
  if (z2 > z3 + 3) {
    defects.push({ name: 'Shoulder บาง / ไหล่ทรุด', severity: 'high', reason: 'Z2 เด่นเกิน Z3 ทำให้เนื้อวิ่งลงจาก shoulder เร็วเกินไป' });
    actions.push('ลด Z2 หรือเพิ่ม Z3 เพื่อ balance flow');
  }
  if (z3 < 106) {
    defects.push({ name: 'Body หนา / ยืดไม่ลง', severity: 'medium', reason: 'Z3 ต่ำเกิน เนื้อช่วง body แข็ง' });
    actions.push('เพิ่ม Z3 ทีละ 1°C แล้วดูความหนาช่วง body');
  }
  if (z4 < 104 || z5 < 101) {
    defects.push({ name: 'Base หนา / ก้นไม่ฟอร์ม', severity: 'high', reason: 'Z4-Z5 เย็นเกิน ทำให้ปลาย preform ไม่ยืด' });
    actions.push('เพิ่ม Z4 ก่อน 1°C ถ้ายังหนาเพิ่ม Z5');
  }
  if (z5 > 109) {
    defects.push({ name: 'Base บาง / ก้นอ่อน', severity: 'medium', reason: 'Z5 ร้อนเกิน เนื้อไหลออกช่วง base เร็วเกินไป' });
    actions.push('ลด Z5 ลง 1°C และดูการกระจายเนื้อช่วง base');
  }
  if (Math.abs(z2 - z3) >= 5 || Math.abs(z4 - z5) >= 5) {
    defects.push({ name: 'Heat imbalance', severity: 'medium', reason: 'Gradient ระหว่าง zone สูงเกิน ทำให้การยืดไม่สมดุล' });
    actions.push('ทำ heat profile ให้ไล่กัน smooth ขึ้น ไม่กระโดดทีละหลายองศา');
  }
  if (primaryBlow > 22 && z2 > 108) {
    defects.push({ name: 'เริ่มต้นยืดแรงเกิน', severity: 'medium', reason: 'Primary blow สูงร่วมกับ shoulder heat สูง ทำให้ยืดต้นทางเร็วเกิน' });
    actions.push('ลด Primary blow หรือ balance Z1-Z2');
  }
  if (secondaryBlow > 34 && z5 > 106) {
    defects.push({ name: 'ปลายขวด/ก้นบางจาก blow ดันแรง', severity: 'low', reason: 'Secondary blow สูงร่วมกับ base heat สูง' });
    actions.push('ตรวจ balance ระหว่าง Secondary blow กับ Z4-Z5');
  }

  const riskScore = clamp(
    defects.reduce((sum, d) => sum + (d.severity === 'high' ? 22 : d.severity === 'medium' ? 12 : 6), 0) +
      Math.abs(z2 - z3) * 1.5 +
      Math.abs(z4 - z5) * 1.2,
    0,
    100
  );

  return {
    heat: { shoulderHeat, upperBodyHeat, lowerBodyHeat, baseHeat },
    thickness: { shoulderThickness, upperBodyThickness, lowerBodyThickness, baseThickness },
    defects,
    actions: [...new Set(actions)].slice(0, 4),
    riskScore,
    likelyMainIssue: defects[0]?.name || 'Heat profile ค่อนข้างสมดุล',
  };
}

function cardStyle() {
  return {
    background: '#fff',
    borderRadius: 24,
    padding: 20,
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
  };
}

function buttonStyle(active = false) {
  return {
    padding: '10px 14px',
    borderRadius: 14,
    border: active ? '1px solid #111827' : '1px solid #d1d5db',
    background: active ? '#111827' : '#fff',
    color: active ? '#fff' : '#111827',
    cursor: 'pointer',
    fontWeight: 600,
  };
}

function PreformHeatView({ zones }) {
  const heights = [18, 20, 22, 24, 16];
  return (
    <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'center', gap: 12, padding: 16 }}>
      {zoneMeta.map((z, i) => (
        <div key={z.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{z.label}</div>
          <div
            style={{
              width: 56,
              height: `${heights[i] * 8}px`,
              background: tempToColor(zones[z.key]),
              borderRadius: '24px 24px 8px 8px',
              border: '1px solid #cbd5e1',
              boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.35)',
            }}
          />
          <div style={{ fontSize: 12, color: '#64748b' }}>{zones[z.key]}°C</div>
        </div>
      ))}
    </div>
  );
}

function BottleThicknessView({ thickness }) {
  const sections = [
    { label: 'Shoulder', value: thickness.shoulderThickness },
    { label: 'Upper body', value: thickness.upperBodyThickness },
    { label: 'Lower body', value: thickness.lowerBodyThickness },
    { label: 'Base', value: thickness.baseThickness },
  ];

  return (
    <div style={{ margin: '0 auto', width: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
      {sections.map((s, idx) => {
        const width = `${clamp((s.value / 130) * 100, 58, 100)}%`;
        const bg = s.value < 88 ? '#ef4444' : s.value > 112 ? '#f59e0b' : '#10b981';
        return (
          <React.Fragment key={s.label}>
            <div
              style={{
                width,
                minHeight: 42,
                background: bg,
                color: '#fff',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                textAlign: 'center',
                padding: '0 8px',
              }}
            >
              {s.label} · {Math.round(s.value)}
            </div>
            {idx < sections.length - 1 && <div style={{ width: 4, height: 10, background: '#cbd5e1', borderRadius: 999 }} />}
          </React.Fragment>
        );
      })}
      <div style={{ fontSize: 12, color: '#64748b', paddingTop: 6 }}>ค่าต่ำ = บาง / ค่าสูง = หนา</div>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const map = {
    high: { bg: '#fee2e2', color: '#b91c1c', text: 'HIGH' },
    medium: { bg: '#fef3c7', color: '#b45309', text: 'MEDIUM' },
    low: { bg: '#dbeafe', color: '#1d4ed8', text: 'LOW' },
  };
  const s = map[severity];
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: '6px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {s.text}
    </span>
  );
}

export default function Page() {
  const [zones, setZones] = useState(defaultZones);
  const [primaryBlow, setPrimaryBlow] = useState(18);
  const [secondaryBlow, setSecondaryBlow] = useState(30);
  const [stretchBias, setStretchBias] = useState(0);

  const result = useMemo(
    () => computeSimulation({ ...zones, primaryBlow, secondaryBlow, stretchBias }),
    [zones, primaryBlow, secondaryBlow, stretchBias]
  );

  const presets = {
    balanced: { zones: { z1: 104, z2: 107, z3: 109, z4: 107, z5: 103 }, primaryBlow: 18, secondaryBlow: 30, stretchBias: 0 },
    shoulderThin: { zones: { z1: 108, z2: 113, z3: 107, z4: 106, z5: 102 }, primaryBlow: 21, secondaryBlow: 30, stretchBias: 1 },
    baseHeavy: { zones: { z1: 103, z2: 106, z3: 106, z4: 102, z5: 99 }, primaryBlow: 17, secondaryBlow: 28, stretchBias: -1 },
  };

  const setZone = (key, value) => setZones((prev) => ({ ...prev, [key]: Number(value) }));

  const applyPreset = (preset) => {
    setZones(preset.zones);
    setPrimaryBlow(preset.primaryBlow);
    setSecondaryBlow(preset.secondaryBlow);
    setStretchBias(preset.stretchBias);
  };

  const resetAll = () => {
    setZones(defaultZones);
    setPrimaryBlow(18);
    setSecondaryBlow(30);
    setStretchBias(0);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: 24, fontFamily: 'Arial, sans-serif', color: '#0f172a' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 999,
                padding: '8px 14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <Thermometer size={16} />
              PET Blow Heat Simulator · Prototype V1
            </div>
            <h1 style={{ marginTop: 16, marginBottom: 10, fontSize: 40, lineHeight: 1.1 }}>Heat → Flow → Thickness → Defect</h1>
            <p style={{ maxWidth: 900, color: '#475569', fontSize: 16, lineHeight: 1.6 }}>
              Prototype นี้ออกแบบให้ใช้เป็นเครื่องมือคิดสำหรับ Nissei ASB PF8-4B โดยเน้นให้คนเห็นความร้อนบน preform
              แล้วแปลไปเป็นพฤติกรรมของเนื้อ ความหนา และ defect risk แบบใช้งานหน้างานได้จริง
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={buttonStyle()} onClick={() => applyPreset(presets.balanced)}>Balanced</button>
            <button style={buttonStyle()} onClick={() => applyPreset(presets.shoulderThin)}>Shoulder issue</button>
            <button style={buttonStyle()} onClick={() => applyPreset(presets.baseHeavy)}>Base issue</button>
            <button style={buttonStyle(true)} onClick={resetAll}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <RotateCcw size={16} /> Reset
              </span>
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '360px 1fr 1fr',
            gap: 24,
          }}
        >
          <div style={cardStyle()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 700, marginBottom: 18 }}>
              <Gauge size={20} />
              Input Control
            </div>

            {zoneMeta.map((z) => (
              <div key={z.key} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  <span>{z.label} · {z.area}</span>
                  <span>{zones[z.key]}°C</span>
                </div>
                <input
                  type="range"
                  min="95"
                  max="120"
                  step="1"
                  value={zones[z.key]}
                  onChange={(e) => setZone(z.key, e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                <span>Primary Blow</span>
                <span>{primaryBlow}</span>
              </div>
              <input type="range" min="10" max="28" step="1" value={primaryBlow} onChange={(e) => setPrimaryBlow(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                <span>Secondary Blow</span>
                <span>{secondaryBlow}</span>
              </div>
              <input type="range" min="20" max="40" step="1" value={secondaryBlow} onChange={(e) => setSecondaryBlow(Number(e.target.value))} style={{ width: '100%' }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                <span>Stretch Bias</span>
                <span>{stretchBias}</span>
              </div>
              <input type="range" min="-4" max="4" step="1" value={stretchBias} onChange={(e) => setStretchBias(Number(e.target.value))} style={{ width: '100%' }} />
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>ค่าบวก = ดึงต้นทางมากขึ้น / ค่าลบ = ดึงลงปลายมากขึ้น</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={cardStyle()}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Preform Heat Distribution</div>
              <PreformHeatView zones={zones} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {zoneMeta.map((z) => (
                  <div key={z.key} style={{ border: '1px solid #e5e7eb', borderRadius: 18, padding: 14, background: 'rgba(255,255,255,0.7)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{z.label}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{z.area}</div>
                      </div>
                      <div style={{ background: '#f1f5f9', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>
                        {zones[z.key]}°C
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        height: 16,
                        width: '100%',
                        borderRadius: 999,
                        background: tempToColor(zones[z.key]),
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle()}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Interpreted Heat Behavior</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { title: 'Shoulder Heat', value: result.heat.shoulderHeat, note: 'ค่าสูงเกิน = เนื้อช่วงต้นวิ่งเร็ว Shoulder บางง่าย' },
                  { title: 'Upper Body Heat', value: result.heat.upperBodyHeat, note: 'ค่านี้กำหนดการกระจายเนื้อหลักช่วง body' },
                  { title: 'Lower Body Heat', value: result.heat.lowerBodyHeat, note: 'สัมพันธ์กับ body ล่างและการเริ่ม feed ลง base' },
                  { title: 'Base Heat', value: result.heat.baseHeat, note: 'ต่ำเกิน = ก้นหนา / สูงเกิน = ก้นบางหรืออ่อน' },
                ].map((item) => (
                  <div key={item.title} style={{ border: '1px solid #e5e7eb', borderRadius: 18, padding: 16, background: '#f8fafc' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>{item.title}</div>
                    <div style={{ marginTop: 4, fontSize: 28, fontWeight: 800 }}>{item.value.toFixed(1)}°C</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{item.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={cardStyle()}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Predicted Bottle Thickness</div>
              <BottleThicknessView thickness={result.thickness} />
            </div>

            <div style={cardStyle()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, fontWeight: 700, marginBottom: 14 }}>
                <Target size={20} />
                Risk & Suggested Action
              </div>

              <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, padding: 16, background: '#f8fafc', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: '#475569' }}>Overall risk score</span>
                  <span style={{ fontSize: 28, fontWeight: 800 }}>{Math.round(result.riskScore)}/100</span>
                </div>
                <div style={{ marginTop: 12, height: 12, width: '100%', background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${result.riskScore}%`,
                      background: result.riskScore > 70 ? '#ef4444' : result.riskScore > 40 ? '#f59e0b' : '#10b981',
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ marginTop: 12, fontSize: 14 }}>
                  <strong>Likely main issue:</strong> {result.likelyMainIssue}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 700, color: '#334155' }}>Predicted defects</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.defects.length === 0 ? (
                    <div style={{ border: '1px solid #bbf7d0', background: '#ecfdf5', color: '#047857', borderRadius: 18, padding: 16, fontSize: 14 }}>
                      Heat profile ยังไม่เห็น defect เด่นชัด ระบบมองว่าอยู่ในช่วงสมดุลพอใช้
                    </div>
                  ) : (
                    result.defects.map((d, idx) => (
                      <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 18, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{d.name}</div>
                          <SeverityBadge severity={d.severity} />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{d.reason}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 700, color: '#334155' }}>Recommended next step</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.actions.length === 0 ? (
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: 18, padding: 14, fontSize: 14, color: '#475569' }}>
                      ยังไม่มี action เร่งด่วน แนะนำยืนยันด้วย thermal scan และเช็ค thickness จริง
                    </div>
                  ) : (
                    result.actions.map((a, i) => (
                      <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 18, padding: 14, fontSize: 14 }}>
                        {i + 1}. {a}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #fde68a',
                  background: '#fffbeb',
                  color: '#92400e',
                  borderRadius: 18,
                  padding: 16,
                  fontSize: 14,
                  lineHeight: 1.6,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <AlertTriangle size={18} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  Prototype นี้เป็น rule-based simulator เพื่อใช้สอนการคิดและทดสอบ scenario ไม่ใช่ physics model เต็มรูปแบบ
                  การตัดสินใจจริงควรยืนยันด้วย thermal scan, bottle thickness และผลหน้างานจริงเสมอ
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
