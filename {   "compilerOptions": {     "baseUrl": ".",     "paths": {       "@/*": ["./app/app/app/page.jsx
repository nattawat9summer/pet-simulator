import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Thermometer, Gauge, Target, RotateCcw } from 'lucide-react';

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
  const hue = 220 - ratio * 220; // blue -> red
  return `hsl(${hue}, 90%, 55%)`;
}

function computeSimulation({ z1, z2, z3, z4, z5, primaryBlow, secondaryBlow, stretchBias }) {
  const shoulderHeat = (z1 * 0.35) + (z2 * 0.65);
  const upperBodyHeat = (z2 * 0.3) + (z3 * 0.7);
  const lowerBodyHeat = (z3 * 0.25) + (z4 * 0.75);
  const baseHeat = (z4 * 0.35) + (z5 * 0.65);

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
    Math.abs(z2 - z3) * 1.5 + Math.abs(z4 - z5) * 1.2,
    0,
    100
  );

  const likelyMainIssue = defects[0]?.name || 'Heat profile ค่อนข้างสมดุล';

  return {
    heat: { shoulderHeat, upperBodyHeat, lowerBodyHeat, baseHeat },
    thickness: { shoulderThickness, upperBodyThickness, lowerBodyThickness, baseThickness },
    defects,
    actions: [...new Set(actions)].slice(0, 4),
    riskScore,
    likelyMainIssue,
  };
}

function ZoneBar({ label, value, area }) {
  return (
    <div className="space-y-2 rounded-2xl border p-3 shadow-sm bg-white/70">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">{label}</div>
          <div className="text-xs text-slate-500">{area}</div>
        </div>
        <Badge variant="secondary">{value}°C</Badge>
      </div>
      <div className="h-4 w-full rounded-full" style={{ background: tempToColor(value) }} />
    </div>
  );
}

function PreformHeatView({ zones }) {
  const heights = [18, 20, 22, 24, 16];
  return (
    <div className="flex items-end justify-center gap-2 p-4">
      {zoneMeta.map((z, i) => (
        <div key={z.key} className="flex flex-col items-center gap-2">
          <div className="text-xs font-medium text-slate-600">{z.label}</div>
          <div
            className="w-14 rounded-t-3xl border border-slate-300 shadow-inner"
            style={{
              height: `${heights[i] * 8}px`,
              background: tempToColor(zones[z.key]),
            }}
          />
          <div className="text-xs text-slate-500">{zones[z.key]}°C</div>
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
    <div className="mx-auto flex w-40 flex-col items-center gap-2 py-4">
      {sections.map((s, idx) => {
        const width = `${clamp((s.value / 130) * 100, 58, 100)}%`;
        const bg = s.value < 88 ? 'bg-red-500' : s.value > 112 ? 'bg-amber-500' : 'bg-emerald-500';
        return (
          <div key={s.label} className="w-full text-center">
            <div className={`mx-auto h-10 rounded-xl ${bg} text-white flex items-center justify-center text-xs font-semibold shadow`} style={{ width }}>
              {s.label} · {Math.round(s.value)}
            </div>
            {idx < sections.length - 1 && <div className="mx-auto h-2 w-1 bg-slate-300" />}
          </div>
        );
      })}
      <div className="text-xs text-slate-500 pt-1">ค่าต่ำ = บาง / ค่าสูง = หนา</div>
    </div>
  );
}

function DefectBadge({ severity, children }) {
  const styles = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[severity]}`}>{children}</span>;
}

export default function PETBlowHeatSimulator() {
  const [zones, setZones] = useState(defaultZones);
  const [primaryBlow, setPrimaryBlow] = useState(18);
  const [secondaryBlow, setSecondaryBlow] = useState(30);
  const [stretchBias, setStretchBias] = useState(0);

  const result = useMemo(
    () => computeSimulation({ ...zones, primaryBlow, secondaryBlow, stretchBias }),
    [zones, primaryBlow, secondaryBlow, stretchBias]
  );

  const setZone = (key, val) => setZones((prev) => ({ ...prev, [key]: val }));

  const presets = {
    balanced: { zones: { z1: 104, z2: 107, z3: 109, z4: 107, z5: 103 }, primaryBlow: 18, secondaryBlow: 30, stretchBias: 0 },
    shoulderThin: { zones: { z1: 108, z2: 113, z3: 107, z4: 106, z5: 102 }, primaryBlow: 21, secondaryBlow: 30, stretchBias: 1 },
    baseHeavy: { zones: { z1: 103, z2: 106, z3: 106, z4: 102, z5: 99 }, primaryBlow: 17, secondaryBlow: 28, stretchBias: -1 },
  };

  const applyPreset = (preset) => {
    setZones(preset.zones);
    setPrimaryBlow(preset.primaryBlow);
    setSecondaryBlow(preset.secondaryBlow);
    setStretchBias(preset.stretchBias);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium shadow-sm border">
              <Thermometer className="h-4 w-4" /> PET Blow Heat Simulator · Prototype V1
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Heat → Flow → Thickness → Defect</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              Prototype นี้ออกแบบให้ใช้เป็นเครื่องมือคิดสำหรับ Nissei ASB PF8-4B โดยเน้นให้คนเห็น “ความร้อนบน preform”
              แล้วแปลไปเป็นพฤติกรรมของเนื้อ ความหนา และ defect risk แบบใช้งานหน้างานได้จริง
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => applyPreset(presets.balanced)}>Balanced</Button>
            <Button variant="outline" onClick={() => applyPreset(presets.shoulderThin)}>Shoulder issue</Button>
            <Button variant="outline" onClick={() => applyPreset(presets.baseHeavy)}>Base issue</Button>
            <Button onClick={() => { setZones(defaultZones); setPrimaryBlow(18); setSecondaryBlow(30); setStretchBias(0); }}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_1fr_1fr]">
          <Card className="rounded-3xl shadow-sm border-0 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Gauge className="h-5 w-5" /> Input Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {zoneMeta.map((z) => (
                <div key={z.key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{z.label} · {z.area}</span>
                    <span>{zones[z.key]}°C</span>
                  </div>
                  <Slider min={95} max={120} step={1} value={[zones[z.key]]} onValueChange={(v) => setZone(z.key, v[0])} />
                </div>
              ))}

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Primary Blow</span>
                  <span>{primaryBlow}</span>
                </div>
                <Slider min={10} max={28} step={1} value={[primaryBlow]} onValueChange={(v) => setPrimaryBlow(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Secondary Blow</span>
                  <span>{secondaryBlow}</span>
                </div>
                <Slider min={20} max={40} step={1} value={[secondaryBlow]} onValueChange={(v) => setSecondaryBlow(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Stretch Bias</span>
                  <span>{stretchBias}</span>
                </div>
                <Slider min={-4} max={4} step={1} value={[stretchBias]} onValueChange={(v) => setStretchBias(v[0])} />
                <p className="text-xs text-slate-500">ค่าบวก = ดึงต้นทางมากขึ้น / ค่าลบ = ดึงลงปลายมากขึ้น</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-sm bg-white">
              <CardHeader>
                <CardTitle>Preform Heat Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <PreformHeatView zones={zones} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {zoneMeta.map((z) => (
                    <ZoneBar key={z.key} label={z.label} value={zones[z.key]} area={z.area} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm bg-white">
              <CardHeader>
                <CardTitle>Interpreted Heat Behavior</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4 border">
                  <div className="text-sm font-semibold text-slate-700">Shoulder Heat</div>
                  <div className="mt-1 text-2xl font-bold">{result.heat.shoulderHeat.toFixed(1)}°C</div>
                  <div className="mt-2 text-xs text-slate-500">ค่าสูงเกิน = เนื้อช่วงต้นวิ่งเร็ว Shoulder บางง่าย</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 border">
                  <div className="text-sm font-semibold text-slate-700">Upper Body Heat</div>
                  <div className="mt-1 text-2xl font-bold">{result.heat.upperBodyHeat.toFixed(1)}°C</div>
                  <div className="mt-2 text-xs text-slate-500">ค่านี้กำหนดการกระจายเนื้อหลักช่วง body</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 border">
                  <div className="text-sm font-semibold text-slate-700">Lower Body Heat</div>
                  <div className="mt-1 text-2xl font-bold">{result.heat.lowerBodyHeat.toFixed(1)}°C</div>
                  <div className="mt-2 text-xs text-slate-500">สัมพันธ์กับ body ล่างและการเริ่ม feed ลง base</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4 border">
                  <div className="text-sm font-semibold text-slate-700">Base Heat</div>
                  <div className="mt-1 text-2xl font-bold">{result.heat.baseHeat.toFixed(1)}°C</div>
                  <div className="mt-2 text-xs text-slate-500">ต่ำเกิน = ก้นหนา / สูงเกิน = ก้นบางหรืออ่อน</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-sm bg-white">
              <CardHeader>
                <CardTitle>Predicted Bottle Thickness</CardTitle>
              </CardHeader>
              <CardContent>
                <BottleThicknessView thickness={result.thickness} />
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Risk & Suggested Action</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Overall risk score</span>
                    <span className="text-2xl font-bold">{Math.round(result.riskScore)}/100</span>
                  </div>
                  <div className="mt-3 h-3 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${result.riskScore}%`, background: result.riskScore > 70 ? '#ef4444' : result.riskScore > 40 ? '#f59e0b' : '#10b981' }} />
                  </div>
                  <div className="mt-3 text-sm"><span className="font-semibold">Likely main issue:</span> {result.likelyMainIssue}</div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-700">Predicted defects</div>
                  <div className="space-y-3">
                    {result.defects.length === 0 ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                        Heat profile ยังไม่เห็น defect เด่นชัด ระบบมองว่าอยู่ในช่วงสมดุลพอใช้
                      </div>
                    ) : result.defects.map((d, idx) => (
                      <div key={idx} className="rounded-2xl border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-sm">{d.name}</div>
                          <DefectBadge severity={d.severity}>{d.severity.toUpperCase()}</DefectBadge>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{d.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold text-slate-700">Recommended next step</div>
                  <div className="space-y-2">
                    {result.actions.length === 0 ? (
                      <div className="rounded-2xl border p-4 text-sm text-slate-600">ยังไม่มี action เร่งด่วน แนะนำยืนยันด้วย thermal scan และเช็ค thickness จริง</div>
                    ) : result.actions.map((a, i) => (
                      <div key={i} className="rounded-2xl border bg-white p-3 text-sm">{i + 1}. {a}</div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    Prototype นี้เป็น rule-based simulator เพื่อใช้สอนการคิดและทดสอบ scenario ไม่ใช่ physics model เต็มรูปแบบ
                    การตัดสินใจจริงควรยืนยันด้วย thermal scan, bottle thickness และผลหน้างานจริงเสมอ
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
