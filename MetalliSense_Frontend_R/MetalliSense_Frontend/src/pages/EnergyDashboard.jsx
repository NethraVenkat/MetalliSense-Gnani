import {useRegisterVoicePage} from '../context/VoicePageContext';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  Zap, IndianRupee, Leaf, ShieldCheck, Gauge, RefreshCw, Lightbulb, Thermometer, Clock, Target, Factory, Timer,
} from "lucide-react";
import {
  ComposedChart, BarChart, Bar, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LabelList, Cell,
} from "recharts";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import { MeltSpinner } from "../components/common/FurnaceLoader";
import { errMsg, MATERIAL_LABEL } from "../components/premelt/premeltUi";
import { getEnergySummary, getEnergyForHeat, simulateHeatEnergy, recordHeatEnergy } from "../services/insightsService";

// Chart colours (validated: amber/green pass CVD with direct labels + legend)
const PRED = "#d97706";
const ACT = "#0e7e46";
const BASE = "#6b7f94";

const inr = (v) => (v === null || v === undefined ? "—" : `₹${Number(v).toLocaleString("en-IN")}`);
const num = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("en-IN"));
const shortGrade = (g) => g.replace("-CARBON-STEEL", " C steel").replace("-IRON", " iron").replace("LOW", "Low").replace("MEDIUM", "Med").replace("HIGH", "High").replace("SG", "SG").replace("GREY", "Grey");

function Kpi({ icon: Icon, label, value, sub, tone = "text-white" }) {
  return (
    <div className="rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3">
      <Icon size={16} className="text-white/40 mb-1" />
      <p className={clsx("text-2xl font-black tabular-nums leading-tight", tone)}>{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">{label}</p>
      {sub && <p className="text-[11px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}

function TipIcon({ k }) {
  const I = { rust: Factory, holding: Timer, moisture: Leaf, tapTemp: Thermometer, tariff: Clock }[k] || Lightbulb;
  return <I size={14} className="text-amber-600" />;
}

// ────────────────────────────────────────────── heat analysis
function HeatAnalysis({ heats, onChanged }) {
  const [params] = useSearchParams();
  const current = heats.filter((h) => !h.history);
  const past = heats.filter((h) => h.history);
  const [heatId, setHeatId] = useState(params.get("heat") || current[0]?.heatId || heats[0]?.heatId || "");
  useRegisterVoicePage({heatId}, 'EnergyDashboard');
  const [tapTempC, setTapTempC] = useState("");
  const [holdingMin, setHoldingMin] = useState(15);
  const [hour, setHour] = useState(new Date().getHours());
  const [e, setE] = useState(null);
  const [actual, setActual] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!heatId) return;
    try {
      const r = await getEnergyForHeat(heatId, { holdingMin, hour, ...(tapTempC ? { tapTempC } : {}) });
      setE(r.data.data);
    } catch (err) { toast.error(errMsg(err)); }
  }, [heatId, holdingMin, hour, tapTempC]);
  useEffect(() => { load(); }, [load]);

  const meter = async (simulate) => {
    setBusy(true);
    try {
      if (simulate) await simulateHeatEnergy(heatId);
      else await recordHeatEnergy(heatId, { actualKwh: Number(actual), by: "Melt shop" });
      setActual("");
      toast.success(`${heatId}: meter reading saved`);
      await load();
      onChanged();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  const heatRow = heats.find((h) => h.heatId === heatId);
  const maxDriver = e ? Math.max(...e.drivers.map((d) => Math.abs(d.kwh))) : 1;
  let running = 0;

  return (
    <Card title="Heat energy analysis">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {current.map((h) => (
          <button key={h.heatId} onClick={() => setHeatId(h.heatId)}
            className={clsx("rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5",
              h.heatId === heatId ? "bg-metal-900 text-white shadow" : "bg-white text-metal-600 ring-1 ring-metal-200 hover:ring-primary-300")}>
            <span className="font-mono">{h.heatId}</span>
            <span className={clsx("w-1.5 h-1.5 rounded-full", h.status === "PLANNED" ? "bg-metal-300" : "bg-orange-500")} />
          </button>
        ))}
        {past.length > 0 && (
          <select value={past.some((h) => h.heatId === heatId) ? heatId : ""} onChange={(ev) => ev.target.value && setHeatId(ev.target.value)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white text-metal-600 ring-1 ring-metal-200">
            <option value="">Past heats ({past.length})…</option>
            {past.map((h) => <option key={h.heatId} value={h.heatId}>{h.heatId} · {h.grade} · {h.status.toLowerCase()}{h.date ? ` · ${new Date(h.date).toLocaleDateString()}` : ""}</option>)}
          </select>
        )}
      </div>

      {!e ? <MeltSpinner label="Calculating heat energy…" /> : (
        <div className="space-y-6">
          {/* headline numbers */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              [Zap, "Predicted energy", `${num(e.kwh)} kWh`, "text-amber-600"],
              [Gauge, "Per tonne", `${e.kwhPerT} kWh/t`, e.kwhPerT > e.baselineKwhPerT * 1.08 ? "text-red-700" : "text-metal-900", `baseline ${e.baselineKwhPerT}`],
              [IndianRupee, "Energy cost", inr(e.rs), "text-metal-900", `${inr(e.rsPerT)}/t · ${e.tariffBand}`],
              [Leaf, "Grid CO₂", `${num(e.co2Kg)} kg`, "text-metal-900"],
              [Target, "Meter vs predicted", e.actual ? `${e.actual.deviationPct > 0 ? "+" : ""}${e.actual.deviationPct}%` : "not metered", e.actual ? (Math.abs(e.actual.deviationPct) > 5 ? "text-red-700" : "text-emerald-700") : "text-metal-400", e.actual ? `${num(e.actual.actualKwh)} kWh actual` : ""],
            ].map(([Icon, l, v, cls, sub]) => (
              <div key={l} className="rounded-xl border border-metal-200 bg-gradient-to-b from-white to-metal-50 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-metal-500 font-semibold flex items-center gap-1"><Icon size={12} />{l}</p>
                <p className={clsx("text-xl font-black tabular-nums mt-0.5", cls)}>{v}</p>
                {sub && <p className="text-[11px] text-metal-400">{sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1.35fr_1fr] gap-6">
            {/* energy build-up */}
            <div>
              <p className="text-sm font-bold text-metal-800 mb-1">How the energy adds up</p>
              <p className="text-xs text-metal-500 mb-3">Base melting energy for the grade, then each charge and process factor adds (or saves) kWh.</p>
              <div className="space-y-2">
                {e.drivers.map((d) => {
                  const start = running;
                  running += d.kwh;
                  return (
                    <div key={d.key} className="grid grid-cols-[minmax(0,1fr)_9rem_4.5rem] items-center gap-3 text-xs">
                      <span className="text-metal-700 truncate" title={d.label}>{d.label}</span>
                      <div className="relative h-3 rounded bg-metal-100 overflow-hidden">
                        <div className={clsx("absolute top-0 bottom-0 rounded", d.key === "base" ? "bg-metal-400" : d.kwh < 0 ? "bg-emerald-500" : "bg-amber-500")}
                          style={{ left: `${(Math.min(start, start + d.kwh) / e.kwh) * 100}%`, width: `${Math.max(0.8, (Math.abs(d.kwh) / e.kwh) * 100)}%` }} />
                      </div>
                      <span className={clsx("text-right tabular-nums font-semibold", d.kwh < 0 ? "text-emerald-700" : "text-metal-800")}>{d.key !== "base" && d.kwh > 0 ? "+" : ""}{num(d.kwh)}</span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[minmax(0,1fr)_9rem_4.5rem] items-center gap-3 text-xs border-t border-metal-200 pt-2">
                  <span className="font-bold text-metal-900">Total predicted</span>
                  <div className="h-3 rounded bg-metal-900" />
                  <span className="text-right tabular-nums font-black">{num(e.kwh)} kWh</span>
                </div>
              </div>
              <p className="text-[10.5px] text-metal-400 mt-2">Bars are drawn to scale of the total ({num(e.kwh)} kWh). Largest single factor: {num(maxDriver)} kWh.</p>

              {/* what-if */}
              <div className="mt-5 rounded-xl border border-metal-200 bg-metal-50 p-4">
                <p className="text-xs font-bold text-metal-800 mb-3">What-if: change the melt practice</p>
                <div className="grid sm:grid-cols-3 gap-4 text-xs">
                  <label className="text-metal-600">Tap temperature (°C)
                    <input type="number" className="block mt-1 w-full rounded-lg border-2 border-metal-200 px-2 py-1.5 text-sm bg-white" placeholder={`ref ${e.tapTempC}`} value={tapTempC} onChange={(ev) => setTapTempC(ev.target.value)} />
                  </label>
                  <label className="text-metal-600">Holding time: <b className="text-metal-900">{holdingMin} min</b>
                    <input type="range" min="0" max="60" value={holdingMin} onChange={(ev) => setHoldingMin(Number(ev.target.value))} className="block mt-2 w-full accent-primary-600" />
                  </label>
                  <label className="text-metal-600">Start hour: <b className="text-metal-900">{String(hour).padStart(2, "0")}:00</b>
                    <input type="range" min="0" max="23" value={hour} onChange={(ev) => setHour(Number(ev.target.value))} className="block mt-2 w-full accent-primary-600" />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {/* tariff scenarios */}
              <div>
                <p className="text-sm font-bold text-metal-800 mb-2">Same heat, different tariff</p>
                <div className="grid grid-cols-3 gap-2">
                  {e.tariffScenarios.map((t) => (
                    <div key={t.band} className={clsx("rounded-xl border px-3 py-2.5", t.band === e.tariffBand ? "border-primary-400 bg-primary-50 ring-2 ring-primary-100" : "border-metal-200 bg-white")}>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-metal-500">{t.band}</p>
                      <p className="text-base font-black tabular-nums text-metal-900">{inr(t.rs)}</p>
                      <p className="text-[10.5px] text-metal-400">₹{t.rate}/kWh</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-metal-500 mt-1.5">Running off-peak instead of peak saves {inr(e.tariffScenarios[2].rs - e.tariffScenarios[0].rs)} on this heat.</p>
              </div>

              {/* charge profile */}
              <div>
                <p className="text-sm font-bold text-metal-800 mb-2">Charge profile</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    ["Rusty scrap", e.profile.rustSharePct, "%"], ["Sponge iron", e.profile.driSharePct, "%"], ["Light scrap", e.profile.lightScrapSharePct, "%"],
                    ["Pig iron / returns", e.profile.denseSharePct, "%"], ["DRI moisture", e.profile.driMoisturePct, "%"], ["DRI fines", e.profile.driFinesPct, "%"],
                  ].filter(([, v]) => v > 0).map(([k, v, u]) => (
                    <span key={k} className="rounded-full bg-metal-100 px-2.5 py-1 text-[11px] text-metal-700"><b className="tabular-nums">{v}{u}</b> {k}</span>
                  ))}
                </div>
                <div className="space-y-1">
                  {e.profile.lines.map((l) => (
                    <div key={l.lotId} className="flex items-center gap-2 text-xs rounded-lg border border-metal-100 px-2.5 py-1.5">
                      <span className="font-mono font-bold w-20">{l.lotId}</span>
                      <span className="text-metal-500 flex-1 truncate">{MATERIAL_LABEL[l.materialType] || l.materialType} · {l.supplier}</span>
                      <span className="tabular-nums">{num(l.kg)} kg</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* tips */}
              <div>
                <p className="text-sm font-bold text-metal-800 mb-2 flex items-center gap-1"><Lightbulb size={14} className="text-amber-500" />How to save on this heat</p>
                {e.tips.length === 0 ? <p className="text-xs text-emerald-700">Already close to the energy baseline.</p> : (
                  <ul className="space-y-1.5">
                    {e.tips.map((t) => (
                      <li key={t.key} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-metal-800">
                        <TipIcon k={t.key} />
                        <span className="flex-1">{t.text}</span>
                        <span className="font-bold text-emerald-700 whitespace-nowrap">{t.kwhSaved > 0 && `${t.kwhSaved} kWh · `}{inr(t.rsSaved)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* meter */}
              {heatRow && heatRow.status !== "PLANNED" && (
                <div className="rounded-xl border border-metal-200 p-3">
                  <p className="text-xs font-bold text-metal-800 mb-2">Energy meter reading</p>
                  {e.actual ? (
                    <p className="text-sm">Actual <b>{num(e.actual.actualKwh)} kWh</b> ({e.actual.kwhPerT} kWh/t) — {e.actual.source === "METER_SIMULATED" ? "simulated meter" : `entered by ${e.actual.by}`}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <input type="number" className="w-28 rounded-lg border-2 border-metal-200 px-2 py-1 text-sm" placeholder="kWh" value={actual} onChange={(ev) => setActual(ev.target.value)} />
                      <Button size="sm" variant="outline" disabled={!actual || busy} onClick={() => meter(false)}>Save reading</Button>
                      <Button size="sm" variant="ghost" loading={busy} onClick={() => meter(true)}>Read meter (sim)</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-metal-400">{e.disclaimer}</p>
        </div>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────── page
export default function EnergyDashboard() {
  useRegisterVoicePage({}, 'EnergyDashboard');
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await getEnergySummary();
      setD(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load energy data"));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const gradeChart = useMemo(() => (d?.byGrade || []).map((g) => ({
    grade: shortGrade(g.grade), Baseline: g.baselineKwhPerT, Predicted: g.avgPredictedKwhPerT, Actual: g.avgActualKwhPerT,
  })), [d]);
  // Current heats plus the latest metered past heats (keeps the chart readable).
  const heatChart = useMemo(() => (d?.heats || []).filter((h) => !h.history || h.actualKwhPerT).slice(0, 14).reverse().map((h) => ({
    heat: h.heatId, Predicted: h.predictedKwhPerT, Actual: h.actualKwhPerT,
  })), [d]);
  const driverChart = useMemo(() => (d?.drivers || []).filter((x) => x.key !== "base").map((x) => ({ ...x, name: x.label })), [d]);
  const baseDriver = d?.drivers?.find((x) => x.key === "base");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* hero — same style as Pre-Melt Gate */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-metal-950 via-metal-900 to-primary-950 text-white p-6 md:p-8 shadow-metal-xl">
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 shadow-lg ring-1 ring-white/20"><Zap size={28} /></span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-primary-300 font-semibold">Induction furnace energy</p>
              <h1 className="text-3xl font-black tracking-tight">Energy per Heat</h1>
              <p className="text-white/60 text-sm max-w-xl mt-1">Energy predicted from the charge before melting, checked against the meter after, and the kWh and rupees saved by catching bad charges at the gate.</p>
            </div>
          </div>
          <button onClick={() => { setLoading(true); load(); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white/70 ring-1 ring-white/15 hover:bg-white/10 hover:text-white"><RefreshCw size={13} />Refresh</button>
        </div>
        {d && (
          <div className="relative grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            <Kpi icon={Gauge} label="Avg kWh / tonne" value={d.totals.avgPredictedKwhPerT ?? "—"} sub={d.totals.avgActualKwhPerT ? `metered ${d.totals.avgActualKwhPerT}` : "predicted"} />
            <Kpi icon={IndianRupee} label="Energy cost / tonne" value={inr(d.avgRsPerT)} sub={`at ₹${d.tariffRsPerKwh}/kWh`} tone="text-amber-300" />
            <Kpi icon={ShieldCheck} label="Saved by the gate" value={inr(d.savings.rsAvoided)} sub={`${num(d.savings.kwhAvoided)} kWh · ${d.savings.badMeltsAvoided} bad melt(s)`} tone="text-primary-300" />
            <Kpi icon={Leaf} label="CO₂ avoided" value={`${num(d.savings.co2AvoidedKg)} kg`} tone="text-primary-300" />
            <Kpi icon={Target} label="Prediction error" value={d.predictionErrorPct === null ? "—" : `±${d.predictionErrorPct}%`} sub={`${d.totals.meltedWithMeter} metered heat(s)`} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-metal-200 bg-white shadow-metal"><MeltSpinner label="Calculating energy…" sublabel="Charge mix, sponge iron, rust, holding and tariff" /></div>
      ) : !d || d.heats.length === 0 ? (
        <Card><p className="text-center text-metal-500 py-8">No heats with a charge yet. Plan a heat on the Pre-Melt Gate to see its energy.</p></Card>
      ) : (
        <>
          <div className="grid lg:grid-cols-[1.25fr_1fr] gap-6">
            <Card title="Where the energy goes">
              <p className="text-xs text-metal-500 -mt-2 mb-3">
                Across {d.totals.heats} heat(s): {num(baseDriver?.kwh)} kWh ({baseDriver?.sharePct}%) is the unavoidable melting energy. The rest comes from the charge and the practice below.
              </p>
              <div style={{ width: "100%", height: Math.max(180, driverChart.length * 38) }}>
                <ResponsiveContainer>
                  <BarChart data={driverChart} layout="vertical" margin={{ top: 0, right: 78, left: 8, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11, fill: "#3d4a5a" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f8" }} formatter={(v, _n, p) => [`${num(v)} kWh (${p.payload.sharePct}%)`, "Energy"]} />
                    <Bar dataKey="kwh" radius={[0, 4, 4, 0]} barSize={16}>
                      {driverChart.map((x) => <Cell key={x.key} fill={x.kwh < 0 ? ACT : PRED} />)}
                      <LabelList dataKey="kwh" position="right" formatter={(v) => `${num(v)} kWh`} style={{ fontSize: 11, fill: "#3d4a5a" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Savings">
              <div className="space-y-4">
                <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
                  <p className="text-[11px] font-bold text-primary-800 uppercase tracking-wider flex items-center gap-1"><ShieldCheck size={12} />Saved by the Pre-Melt Gate</p>
                  <p className="text-3xl font-black text-primary-700 tabular-nums mt-1">{num(d.savings.kwhAvoided)} kWh</p>
                  <p className="text-sm text-primary-900">{inr(d.savings.rsAvoided)} · {num(d.savings.co2AvoidedKg)} kg CO₂ · {d.savings.badMeltsAvoided} bad melt(s) stopped before the furnace started</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-metal-600 uppercase tracking-wider mb-2 flex items-center gap-1"><Lightbulb size={12} className="text-amber-500" />Still available — {inr(d.savings.potentialRs)} · {num(d.savings.potentialKwh)} kWh</p>
                  {d.savingsByType.length === 0 ? <p className="text-xs text-metal-500">No further savings found on current heats.</p> : (
                    <div className="space-y-1.5">
                      {d.savingsByType.map((t) => {
                        const max = Math.max(...d.savingsByType.map((x) => x.rs));
                        return (
                          <div key={t.key} className="grid grid-cols-[1.25rem_8.5rem_1fr_4.5rem] items-center gap-2 text-xs">
                            <TipIcon k={t.key} />
                            <span className="text-metal-700">{t.label} <span className="text-metal-400">· {t.heats} heat{t.heats > 1 ? "s" : ""}</span></span>
                            <div className="h-2 rounded-full bg-metal-100 overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{ width: `${(t.rs / max) * 100}%` }} /></div>
                            <span className="text-right tabular-nums font-semibold">{inr(t.rs)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-metal-500">{d.savings.note} Tariff ₹{d.tariffRsPerKwh}/kWh, grid factor {d.gridCo2KgPerKwh} kg CO₂/kWh (illustrative).</p>
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="kWh per tonne by grade">
              <div style={{ width: "100%", height: 270 }}>
                <ResponsiveContainer>
                  <ComposedChart data={gradeChart} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eef1f4" />
                    <XAxis dataKey="grade" tick={{ fontSize: 11, fill: "#4f5f73" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7f94" }} width={40} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f8" }} formatter={(v) => (v === null || v === undefined ? "—" : `${v} kWh/t`)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Predicted" fill={PRED} radius={[4, 4, 0, 0]} barSize={26}><LabelList dataKey="Predicted" position="top" style={{ fontSize: 10, fill: "#3d4a5a" }} /></Bar>
                    <Bar dataKey="Actual" fill={ACT} radius={[4, 4, 0, 0]} barSize={26}><LabelList dataKey="Actual" position="top" style={{ fontSize: 10, fill: "#3d4a5a" }} /></Bar>
                    <Scatter dataKey="Baseline" fill={BASE} shape={(p) => <rect x={p.cx - 30} y={p.cy - 1.5} width={60} height={3} rx={1.5} fill={BASE} />} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-metal-500">Grey marker = baseline kWh/t for the grade (clean charge, reference tap temperature, no holding).</p>
            </Card>

            <Card title="Predicted vs metered, by heat">
              <div style={{ width: "100%", height: 270 }}>
                <ResponsiveContainer>
                  <BarChart data={heatChart} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eef1f4" />
                    <XAxis dataKey="heat" tick={{ fontSize: 11, fill: "#4f5f73" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#6b7f94" }} width={40} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f8" }} formatter={(v) => (v === null || v === undefined ? "not metered" : `${v} kWh/t`)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Predicted" fill={PRED} radius={[4, 4, 0, 0]} barSize={18}><LabelList dataKey="Predicted" position="top" style={{ fontSize: 10, fill: "#3d4a5a" }} /></Bar>
                    <Bar dataKey="Actual" fill={ACT} radius={[4, 4, 0, 0]} barSize={18}><LabelList dataKey="Actual" position="top" style={{ fontSize: 10, fill: "#3d4a5a" }} /></Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-metal-500">Metered heats show how close the pre-melt prediction was (average error {d.predictionErrorPct === null ? "—" : `±${d.predictionErrorPct}%`}).</p>
            </Card>
          </div>

          <HeatAnalysis heats={d.heats} onChanged={load} />

          <Card title="All heats">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[820px]">
                <thead><tr className="text-left text-xs text-metal-500 border-b border-metal-200">
                  <th className="px-2 py-2">Heat</th><th className="px-2">Grade</th><th className="px-2">Status</th><th className="px-2 text-right">Charge t</th>
                  <th className="px-2 text-right">Predicted kWh</th><th className="px-2 text-right">kWh/t</th><th className="px-2 text-right">₹/t</th><th className="px-2 text-right">Metered kWh/t</th><th className="px-2 text-right">Can save</th>
                </tr></thead>
                <tbody>
                  {d.heats.map((h) => (
                    <tr key={h.heatId} className="border-b border-metal-100">
                      <td className="px-2 py-2 font-mono font-bold whitespace-nowrap">{h.heatId}{h.gateHeld && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">GATE HELD</span>}</td>
                      <td className="px-2 text-xs">{h.grade}</td>
                      <td className="px-2"><span className={clsx("inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold", h.status === "PLANNED" ? "bg-metal-100 text-metal-600" : "bg-orange-100 text-orange-800")}>{h.status.toLowerCase()}</span></td>
                      <td className="px-2 text-right tabular-nums">{h.chargeT}</td>
                      <td className="px-2 text-right tabular-nums">{num(h.predictedKwh)}</td>
                      <td className="px-2 text-right tabular-nums">{h.predictedKwhPerT}</td>
                      <td className="px-2 text-right tabular-nums">{inr(h.rsPerT)}</td>
                      <td className={clsx("px-2 text-right tabular-nums font-semibold", h.actualKwhPerT && h.actualKwhPerT > h.predictedKwhPerT * 1.05 ? "text-red-700" : "text-metal-900")}>{h.actualKwhPerT ?? "—"}</td>
                      <td className="px-2 text-right tabular-nums text-emerald-700">{h.potentialKwhSaved ? `${h.potentialKwhSaved} kWh` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
