import {useRegisterVoicePage} from '../context/VoicePageContext';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  PackageSearch, AlertOctagon, ShoppingCart, CalendarClock, IndianRupee, ClipboardList, RefreshCw, X, Truck, Check,
  AlertTriangle, Info, Factory, FlaskConical, ArrowRight,
} from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend,
} from "recharts";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import { MeltSpinner } from "../components/common/FurnaceLoader";
import { StatusPill, errMsg, inputCls } from "../components/premelt/premeltUi";
import {
  getInventoryForecast, getInventoryItem, getPurchaseRequests, createPurchaseRequest, approvePurchaseRequest, rejectPurchaseRequest,
} from "../services/inventoryService";

// ─────────────────────────────────────────────── constants
const STATUS = {
  CRITICAL: { label: "Critical", chip: "bg-red-600 text-white", ring: "#dc2626", soft: "border-red-200 bg-red-50", text: "text-red-700", bar: "bg-red-500" },
  REORDER: { label: "Reorder now", chip: "bg-orange-500 text-white", ring: "#f97316", soft: "border-orange-200 bg-orange-50", text: "text-orange-700", bar: "bg-orange-500" },
  OK: { label: "OK", chip: "bg-emerald-600 text-white", ring: "#059669", soft: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
  OVERSTOCK: { label: "Overstock", chip: "bg-sky-600 text-white", ring: "#0284c7", soft: "border-sky-200 bg-sky-50", text: "text-sky-700", bar: "bg-sky-500" },
  NO_DEMAND: { label: "No demand", chip: "bg-metal-200 text-metal-700", ring: "#94a3b8", soft: "border-metal-200 bg-metal-50", text: "text-metal-500", bar: "bg-metal-300" },
};
const PR_STATUS = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-amber-300",
  APPROVED: "bg-sky-100 text-sky-800 border-sky-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
  RECEIVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
};
const GRADE_STYLE = { A: "bg-emerald-600 text-white", B: "bg-sky-600 text-white", C: "bg-amber-500 text-metal-950", D: "bg-red-700 text-white", NEW: "bg-metal-200 text-metal-700" };

const n = (v, dp = 0) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: dp }));
const kgs = (v) => (v === null || v === undefined ? "—" : `${n(v)} kg`);
const rs = (v) => (v === null || v === undefined ? "—" : `₹${n(v)}`);
const dateShort = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");

function StatusChip({ status, className }) {
  const s = STATUS[status] || STATUS.NO_DEMAND;
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap", s.chip, className)}>{s.label}</span>;
}
function GradeBadge({ grade, small }) {
  if (!grade) return null;
  return <span className={clsx("inline-grid place-items-center rounded font-black", small ? "w-5 h-5 text-[10px]" : "w-7 h-7 text-xs", GRADE_STYLE[grade] || GRADE_STYLE.NEW)}>{grade === "NEW" ? "N" : grade}</span>;
}

// Circular days-of-cover gauge (full ring = 30 days).
function CoverGauge({ days, lead, status, size = 112 }) {
  const s = STATUS[status] || STATUS.NO_DEMAND;
  const max = 30;
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const frac = days === null || days === undefined ? 0 : Math.min(1, days / max);
  const leadFrac = Math.min(1, (lead + 1) / max);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f4" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fecaca" strokeWidth="10" strokeDasharray={`${leadFrac * c} ${c}`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.ring} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${frac * c} ${c}`} style={{ transition: "stroke-dasharray .7s" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-black tabular-nums text-metal-900 leading-none">{days === null || days === undefined ? "—" : days > 99 ? "99+" : n(days, days < 10 ? 1 : 0)}</p>
          <p className="text-[10px] uppercase tracking-wider text-metal-500 font-semibold mt-0.5">days cover</p>
        </div>
      </div>
    </div>
  );
}

function Dialog({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-metal-950/50 backdrop-blur-[2px] p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-metal-100">
          <h3 className="font-bold text-metal-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-metal-400 hover:text-metal-700" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────── "why this supplier?"
// Plain-language reasons built from Supplier Scorecard numbers (no AI guesswork).
function WhyBox({ why, defaultOpen = false, label = "Why this supplier?" }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen, why]);
  if (!why) return null;
  const ICON = {
    pro: <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />,
    con: <IndianRupee size={14} className="text-amber-600 shrink-0 mt-0.5" />,
    risk: <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />,
  };
  return (
    <div className="mb-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline">
        <Info size={13} />{open ? "Hide reasons" : label}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-metal-200 bg-metal-50/70 p-3">
          <p className="text-sm font-bold text-metal-900">{why.title}</p>
          <ul className="mt-2 space-y-1.5">
            {why.points.map((p, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug text-metal-700">{ICON[p.tone] || ICON.pro}<span>{p.text}</span></li>
            ))}
          </ul>
          <p className="mt-2.5 pt-2 border-t border-metal-200 text-[13px] font-semibold text-metal-900">{why.verdict}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────── create PR
// Supplier picker: all suppliers of this material from the Supplier Scorecard, in a pop-up list.
function SupplierPicker({ options, value, qty, onChange }) {
  const [open, setOpen] = useState(false);
  const best = options.find((o) => o.recommended) || options[0];
  const cur = options.find((o) => o.name === value) || best;
  const q = Number(qty) || 0;
  const est = (o) => (o.lastRsPerKg ? q * o.lastRsPerKg : null);
  const trueTotal = (o) => (o.effectiveRsPerT ? (q * o.effectiveRsPerT) / 1000 : null);
  const diff = (o) => (best?.effectiveRsPerT && o.effectiveRsPerT ? ((o.effectiveRsPerT - best.effectiveRsPerT) / 1000) * q : null);
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [open]);
  if (!cur) return null;
  return (
    <div className="relative mb-4">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}
        className={clsx("w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors", open ? "border-primary-400 ring-2 ring-primary-100" : "border-metal-200 hover:border-primary-300")}>
        <GradeBadge grade={cur.grade} />
        <div className="text-sm flex-1 min-w-0">
          <p className="font-semibold text-metal-900 truncate">{cur.name}{cur.recommended && <span className="ml-2 rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold align-middle">RECOMMENDED</span>}</p>
          <p className="text-xs text-metal-500">Rank {cur.rank} of {cur.rankOf} · score {cur.score} · effective ₹{n(cur.effectiveRsPerT / 1000, 1)}/kg · last price ₹{n(cur.lastRsPerKg, 1)}/kg</p>
        </div>
        <span className="text-xs font-semibold text-primary-700 whitespace-nowrap">{options.length > 1 ? `${options.length} suppliers ▾` : ""}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[1]" onClick={() => setOpen(false)} />
          <ul role="listbox" aria-label="Suppliers" className="absolute left-0 right-0 top-full mt-2 z-[2] max-h-[22rem] overflow-y-auto rounded-xl border border-metal-200 bg-white shadow-2xl p-1.5">
            <li className="px-2.5 pt-1 pb-2 text-[11px] text-metal-500">Ranked by the Supplier Scorecard (quality, cost, delivery, service). True cost includes yield loss and rejections.</li>
            {options.map((o) => {
              const d = diff(o);
              const selected = o.name === cur.name;
              return (
                <li key={o.name} role="option" aria-selected={selected} aria-disabled={o.blocked}>
                  <button type="button" disabled={o.blocked} onClick={() => { onChange(o); setOpen(false); }}
                    className={clsx("w-full text-left rounded-lg px-2.5 py-2 flex items-start gap-3 transition-colors",
                      o.blocked ? "opacity-50 cursor-not-allowed" : selected ? "bg-primary-50 ring-1 ring-primary-200" : "hover:bg-metal-50")}>
                    <span className="w-5 text-center text-xs font-black text-metal-400 pt-1.5">#{o.rank}</span>
                    <GradeBadge grade={o.grade} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-metal-900 truncate">{o.name}</span>
                        {o.recommended && <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">RECOMMENDED</span>}
                        {selected && <Check size={14} className="text-primary-600" />}
                      </span>
                      <span className="block text-[11px] text-metal-500">Score {o.score ?? "—"} · {o.note} · inspect {o.inspectPieces} pcs/lot</span>
                      <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] tabular-nums">
                        <span className="text-metal-700">Last ₹{n(o.lastRsPerKg, 1)}/kg</span>
                        <span className="text-metal-700">True ₹{n(o.effectiveRsPerT / 1000, 1)}/kg</span>
                        <span className="text-metal-900 font-semibold">Invoice {rs(est(o))}</span>
                        <span className="text-metal-900 font-semibold">True cost {rs(trueTotal(o))}</span>
                        {d !== null && Math.abs(d) >= 1 && !o.recommended && (
                          <span className={clsx("font-semibold", d > 0 ? "text-red-700" : "text-emerald-700")}>{d > 0 ? `+${rs(d)} true cost` : `${rs(-d)} lower true cost`}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function CreatePrDialog({ item, onClose, onCreated }) {
  const [qty, setQty] = useState(item.orderKg || 0);
  const [by, setBy] = useState("");
  const [reason, setReason] = useState(item.statusReason || "");
  const [busy, setBusy] = useState(false);
  const options = item.supplierOptions?.length ? item.supplierOptions : (item.supplier ? [{ ...item.supplier, recommended: true, note: "Best rank — recommended", inspectPieces: "—" }] : []);
  const recommended = options.find((o) => o.recommended) || options[0];
  const [chosen, setChosen] = useState(recommended || null);
  const price = chosen?.lastRsPerKg;
  const switched = chosen && recommended && chosen.name !== recommended.name;
  const trueDiff = switched && chosen.effectiveRsPerT && recommended.effectiveRsPerT ? ((chosen.effectiveRsPerT - recommended.effectiveRsPerT) / 1000) * (Number(qty) || 0) : 0;
  const submit = async () => {
    setBusy(true);
    try {
      const r = await createPurchaseRequest({
        item: item.item, qtyKg: Number(qty), requestedBy: by, supplier: chosen?.name,
        reason: switched ? `${reason} [Supplier changed from recommended ${recommended.name} to ${chosen.name}]` : reason,
      });
      toast.success(`${r.data.data.prId} raised — waiting for manager approval`);
      onCreated(r.data.data);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog title={`Purchase request — ${item.label}`} onClose={onClose}>
      {options.length > 0 && <SupplierPicker options={options} value={chosen?.name} qty={qty} onChange={setChosen} />}
      {switched && (
        <p className={clsx("-mt-2 mb-2 rounded-lg px-3 py-2 text-xs", trueDiff > 0 ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-sky-50 border border-sky-200 text-sky-900")}>
          Not the recommended supplier{trueDiff > 0 ? ` — about ${rs(trueDiff)} more in true cost` : trueDiff < 0 ? ` — about ${rs(-trueDiff)} lower in true cost` : ""}. The change is noted on the request for the manager.
        </p>
      )}
      <WhyBox key={chosen?.name} why={switched ? chosen?.whyNot : item.whyRecommended} defaultOpen={!!switched}
        label={switched ? `Why we recommend ${recommended?.name} instead` : "Why this supplier?"} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-metal-700">Quantity (kg)
          <input type="number" min="1" className={clsx(inputCls, "mt-1")} value={qty} onChange={(e) => setQty(e.target.value)} />
          <span className="block text-[11px] font-normal text-metal-500 mt-1">Suggested {kgs(item.orderKg)} (EOQ {kgs(item.eoqKg)})</span>
        </label>
        <label className="text-xs font-semibold text-metal-700">Requested by (stores)
          <input className={clsx(inputCls, "mt-1")} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" />
        </label>
      </div>
      <label className="block text-xs font-semibold text-metal-700 mt-3">Reason
        <textarea rows={2} className={clsx(inputCls, "mt-1")} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-metal-700">Invoice <b className="tabular-nums">{price ? rs(Number(qty) * price) : "—"}</b>
          {chosen?.effectiveRsPerT && <> · true cost <b className="tabular-nums">{rs((Number(qty) * chosen.effectiveRsPerT) / 1000)}</b></>}
          {chosen && <span className="block text-[11px] text-metal-500">{chosen.name}: ₹{n(price, 1)}/kg invoice, ₹{n(chosen.effectiveRsPerT / 1000, 1)}/kg true cost</span>}</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} loading={busy} disabled={!by.trim() || !(Number(qty) > 0) || chosen?.blocked}>Create PR</Button>
        </div>
      </div>
    </Dialog>
  );
}

function ApproveDialog({ pr, mode, onClose, onDone }) {
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      if (mode === "approve") await approvePurchaseRequest(pr.prId, by);
      else await rejectPurchaseRequest(pr.prId, by, reason);
      toast.success(`${pr.prId} ${mode === "approve" ? "approved" : "rejected"}`);
      onDone();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog title={`${mode === "approve" ? "Approve" : "Reject"} ${pr.prId}`} onClose={onClose}>
      <p className="text-sm text-metal-700 mb-3">{pr.label}: <b>{kgs(pr.qtyKg)}</b> from <b>{pr.supplier}</b> · est. {rs(pr.estTotalRs)} · requested by {pr.requestedBy}</p>
      <label className="block text-xs font-semibold text-metal-700">Manager name
        <input className={clsx(inputCls, "mt-1")} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Must differ from the requester" />
      </label>
      {mode === "reject" && (
        <label className="block text-xs font-semibold text-metal-700 mt-3">Reason
          <input className={clsx(inputCls, "mt-1")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Quantity too high — order 150 kg" />
        </label>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant={mode === "reject" ? "danger" : "primary"} onClick={go} loading={busy} disabled={!by.trim() || (mode === "reject" && reason.trim().length < 5)}>
          {mode === "approve" ? "Approve" : "Reject"}
        </Button>
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────────────────── item detail (full screen)
function Section({ num, title, hint, children, className }) {
  return (
    <section className={clsx("rounded-2xl bg-white ring-1 ring-metal-200 shadow-sm p-5", className)}>
      <div className="flex items-center gap-2 mb-2">
        {num && <span className="grid place-items-center w-6 h-6 rounded-full bg-metal-900 text-white text-[11px] font-black">{num}</span>}
        <h3 className="text-sm font-bold text-metal-900">{title}</h3>
      </div>
      {hint && <p className="text-xs text-metal-500 mb-3">{hint}</p>}
      {children}
    </section>
  );
}

function ItemDetail({ itemKey, onClose, onCreatePr }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    getInventoryItem(itemKey).then((r) => setD(r.data.data)).catch((e) => toast.error(errMsg(e)));
  }, [itemKey]);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  const chart = useMemo(() => {
    if (!d) return [];
    const rows = d.history.map((h) => ({ label: dateShort(h.date), onHand: h.onHandKg }));
    d.projection.forEach((p, i) => {
      const label = i === 0 ? "Today" : dateShort(p.date);
      if (i === 0) rows.push({ label, onHand: d.onHandKg, projected: p.projectedKg });
      else rows.push({ label, projected: p.projectedKg });
    });
    return rows;
  }, [d]);
  const leadEnd = d ? (d.leadDays > 0 ? dateShort(d.projection[Math.min(d.leadDays, d.projection.length - 1)]?.date) : null) : null;
  const s = STATUS[d?.status] || STATUS.NO_DEMAND;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-metal-950/50 backdrop-blur-[2px]" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`${itemKey} forecast`} className="h-full w-full overflow-y-auto bg-metal-50" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-gradient-to-r from-metal-950 via-metal-900 to-primary-950 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex flex-wrap items-center gap-4">
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-white/10 ring-1 ring-white/20">{d?.group === "ALLOY" ? <FlaskConical size={24} /> : <Factory size={24} />}</span>
            <div className="flex-1 min-w-[14rem]">
              <p className="text-[11px] uppercase tracking-[0.2em] text-primary-300 font-semibold">{d?.group === "ALLOY" ? "Ferro-alloy" : "Charge material"} · lead time {d?.leadDays ?? "—"} days</p>
              <h2 className="text-xl font-bold flex items-center gap-3">{d?.label || itemKey}{d && <StatusChip status={d.status} />}</h2>
              <p className="text-sm text-white/60">{d?.statusReason}</p>
            </div>
            {d && (
              <div className="grid grid-cols-4 gap-2">
                {[["Usable", kgs(d.usableKg)], ["Daily use", `${n(d.dailyDemandKg, 1)} kg`], ["Reorder point", kgs(d.reorderPointKg)], ["Stock-out", d.stockOutAt ? dateShort(d.stockOutAt) : "—"]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/5 ring-1 ring-white/10 px-3 py-2 min-w-[7rem]">
                    <p className="text-base font-black tabular-nums">{v}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/50">{k}</p>
                  </div>
                ))}
              </div>
            )}
            <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white/80 ring-1 ring-white/20 hover:bg-white/10" aria-label="Close"><X size={16} />Close <span className="text-white/40">Esc</span></button>
          </div>
        </div>

        {!d ? <div className="max-w-7xl mx-auto p-8"><MeltSpinner label="Forecasting…" /></div> : (
          <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
            {d.warnings?.length > 0 && (
              <div className="grid md:grid-cols-2 gap-2">
                {d.warnings.map((w, i) => (
                  <div key={i} className={clsx("flex gap-2 rounded-lg border px-3 py-2 text-xs", w.level === "info" ? "border-sky-200 bg-sky-50 text-sky-900" : "border-amber-200 bg-amber-50 text-amber-900")}>
                    {w.level === "info" ? <Info size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}<span>{w.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
              <div className="space-y-6 min-w-0">
              <Section num="1" title="Stock projection" hint={`Last 30 days of stock on hand, then ${d.projection.length - 1} days of projected usable stock at ${n(d.dailyDemandKg, 1)} kg/day. The shaded band is the ${d.leadDays}-day lead time: an order placed today arrives at its end.`}>
                <div style={{ width: "100%", height: 320 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={chart} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#eef1f4" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7f94" }} tickLine={false} axisLine={false} interval={3} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7f94" }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => n(v)} />
                      <Tooltip formatter={(v, name) => [kgs(v), name === "onHand" ? "On hand (all lots)" : "Projected usable"]} />
                      <Legend formatter={(v) => (v === "onHand" ? "On hand (all lots)" : "Projected usable")} wrapperStyle={{ fontSize: 12 }} />
                      {leadEnd && <ReferenceArea x1="Today" x2={leadEnd} fill="#fde68a" fillOpacity={0.35} label={{ value: "lead time", position: "insideTop", fontSize: 10, fill: "#92400e" }} />}
                      <ReferenceLine y={d.reorderPointKg} stroke="#f97316" strokeDasharray="5 4" label={{ value: `Reorder point ${n(d.reorderPointKg)}`, position: "insideTopRight", fontSize: 10, fill: "#c2410c" }} />
                      <ReferenceLine y={d.safetyStockKg} stroke="#dc2626" strokeDasharray="2 3" label={{ value: `Safety stock ${n(d.safetyStockKg)}`, position: "insideBottomRight", fontSize: 10, fill: "#b91c1c" }} />
                      <ReferenceLine x="Today" stroke="#0f172a" strokeWidth={1.5} />
                      <Area type="monotone" dataKey="onHand" stroke="#334155" fill="#cbd5e1" fillOpacity={0.35} strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="projected" stroke={s.ring} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 2.5 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Section>
              <Section num="2" title="Where the demand comes from" hint="Planned heats on the Pre-Melt Gate that need this item.">
                {d.demandSources.length === 0 ? <p className="text-sm text-metal-500">No planned heats need it right now — demand is from the use history.</p> : (
                  <ul className="space-y-1.5 text-sm">
                    {d.demandSources.map((x) => (
                      <li key={x.heatId} className="flex items-center gap-2">
                        <span className="font-mono font-bold text-metal-900">{x.heatId}</span>
                        <span className="text-metal-600">needs <b>{n(x.kg, 1)} kg</b></span>
                        <span className="ml-auto text-[11px] text-metal-400 text-right">{x.source}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              </div>

              <div className="space-y-6">
                {!d.inHouse && d.supplier && (
                  <Section num="3" title="Suggested supplier" hint="Best-ranked supplier on the Supplier Scorecard for this material (grade D is never suggested).">
                    <div className="flex items-center gap-3">
                      <GradeBadge grade={d.supplier.grade} />
                      <div className="flex-1">
                        <p className="font-bold text-metal-900">{d.supplier.name}</p>
                        <p className="text-xs text-metal-500">Grade {d.supplier.grade} · score {d.supplier.score} · rank {d.supplier.rank} of {d.supplier.rankOf}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                      <div className="rounded-lg border border-metal-200 py-2"><p className="font-black tabular-nums">₹{n(d.supplier.lastRsPerKg, 1)}/kg</p><p className="text-[10.5px] text-metal-500">last price</p></div>
                      <div className="rounded-lg border border-metal-200 py-2"><p className="font-black tabular-nums">₹{n(d.supplier.effectiveRsPerT / 1000, 1)}/kg</p><p className="text-[10.5px] text-metal-500">effective (true) cost</p></div>
                    </div>
                    {d.openPr ? (
                      <p className="mt-3 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-900"><b>{d.openPr.prId}</b> already raised ({d.openPr.status.replace("_", " ").toLowerCase()}) for {kgs(d.openPr.qtyKg)}.</p>
                    ) : (
                      <Button className="w-full mt-3" onClick={() => onCreatePr(d)}>
                        <ShoppingCart size={15} className="mr-1.5" />Create PR for {kgs(d.orderKg)} · {rs(d.estTotalRs)}
                      </Button>
                    )}
                    <div className="mt-3 -mb-3"><WhyBox why={d.whyRecommended} /></div>
                  </Section>
                )}
                {d.inHouse && (
                  <Section num="3" title="Made in-house">
                    <p className="text-sm text-metal-600">Foundry returns (runners, risers, rejects) come from our own heats, so they are not purchased. Their forecast shows how long the returns in stock last.</p>
                  </Section>
                )}
              </div>
            </div>

            <Section num="4" title="How the reorder was calculated" hint="Every number comes from the stock ledger, the planned heats and the settings below.">
              <ol className="grid md:grid-cols-2 gap-3">
                {d.steps.map((st, i) => (
                  <li key={st.title} className="rounded-xl border border-metal-200 p-3 flex gap-3">
                    <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-metal-100 text-metal-700 text-[11px] font-black">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-metal-900 text-sm">{st.title}</p>
                        <p className="font-black tabular-nums text-metal-900 text-sm whitespace-nowrap">{st.value}</p>
                      </div>
                      <p className="text-[10.5px] font-mono text-metal-400 mt-0.5">{st.formula}</p>
                      <p className="text-xs text-metal-700 mt-1">{st.calc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-[11px] text-metal-500 mt-3">
                Settings: service level {Math.round(d.settings.serviceLevel * 100)}% (z = {d.z}), α = {d.settings.alpha}, horizon {d.settings.horizonDays} days, lead time {d.leadDays} days,
                order cost ₹{n(d.settings.orderCostRs)}, holding {d.settings.holdingPct}%/year, minimum order {kgs(d.settings.minOrderKg)}.
                Status: critical if cover &lt; lead time + 1 day or below safety stock; reorder if at or below the reorder point; overstock above 60 days of cover.
              </p>
            </Section>

            <Section num="5" title="Lots in stock (oldest first — use in this order)">
              {d.lots.length === 0 ? <p className="text-sm text-metal-500">No lots in stock.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[720px]">
                    <thead><tr className="text-left text-[11px] text-metal-500 border-b border-metal-200">
                      <th className="py-2">Lot</th><th>Supplier</th><th>Status</th><th className="text-right">Age</th><th className="text-right">Available</th><th className="text-right">Counted as usable</th><th className="text-right">₹/kg</th><th className="pl-3">Note</th>
                    </tr></thead>
                    <tbody>
                      {d.lots.map((l) => (
                        <tr key={l.lotId} className={clsx("border-b border-metal-100", l.warning && "bg-amber-50/60")}>
                          <td className="py-2 font-mono font-bold">{l.lotId}</td>
                          <td className="text-metal-700">{l.supplier}</td>
                          <td><StatusPill status={l.status} /></td>
                          <td className={clsx("text-right tabular-nums", l.warning && "text-amber-700 font-bold")}>{n(l.ageDays, 0)} d</td>
                          <td className="text-right tabular-nums">{kgs(l.availableKg)}</td>
                          <td className={clsx("text-right tabular-nums font-semibold", l.countedKg ? "text-metal-900" : "text-metal-400")}>{kgs(l.countedKg)}</td>
                          <td className="text-right tabular-nums">{l.costPerKg}</td>
                          <td className="pl-3 text-metal-500">{l.warning || l.note || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────── page
export default function InventoryForecast() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(params.get("item") || null);
  useRegisterVoicePage({item:detail}, 'InventoryForecast');
  const [prFor, setPrFor] = useState(null);
  const [act, setAct] = useState(null); // { pr, mode }

  const load = useCallback(async () => {
    try {
      const [f, p] = await Promise.all([getInventoryForecast(), getPurchaseRequests()]);
      setData(f.data.data);
      setPrs(p.data.data);
    } catch (e) { toast.error(errMsg(e, "Could not load the inventory forecast")); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openDetail = (key) => { setDetail(key); setParams(key ? { item: key } : {}); };
  const items = data?.items || [];
  const alloys = items.filter((i) => i.group === "ALLOY");
  const charge = items.filter((i) => i.group === "CHARGE");
  const sm = data?.summary;
  const actionFor = (i, big) => {
    if (i.inHouse) return <span className="text-[11px] text-metal-400">In-house</span>;
    if (i.openPr) return <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-[11px] font-bold"><ClipboardList size={11} />PR raised · {i.openPr.prId}</span>;
    if (["CRITICAL", "REORDER"].includes(i.status)) {
      return (
        <Button size="sm" variant={i.status === "CRITICAL" ? "danger" : "primary"} className={big ? "w-full" : ""} onClick={(e) => { e.stopPropagation(); setPrFor(i); }}>
          <ShoppingCart size={13} className="mr-1" />Create PR{big ? ` · ${kgs(i.orderKg)}` : ""}
        </Button>
      );
    }
    return big ? <button onClick={(e) => { e.stopPropagation(); setPrFor(i); }} className="w-full text-xs font-semibold text-metal-500 hover:text-primary-700 py-1.5">Create PR anyway</button> : null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-metal-950 via-metal-900 to-primary-950 text-white p-6 md:p-8 shadow-metal-xl">
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 shadow-lg ring-1 ring-white/20"><PackageSearch size={28} /></span>
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-primary-300 font-semibold">Raw material intelligence · forecast &amp; reorder</p>
              <h1 className="text-3xl font-black tracking-tight">Inventory Forecast</h1>
              <p className="text-white/60 text-sm max-w-2xl mt-1">What the melt shop will use, when each material runs out, and what to buy — how much, and from the supplier with the lowest true cost.</p>
            </div>
          </div>
          <button onClick={() => { setLoading(true); load(); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/15 hover:bg-white/10"><RefreshCw size={13} />Refresh</button>
        </div>
        <div className="relative grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          {[
            [AlertOctagon, "Items critical", sm?.critical ?? "—", "text-red-300"],
            [ShoppingCart, "Reorder now", sm?.reorder ?? "—", "text-orange-300"],
            [CalendarClock, sm?.nextStockOut ? `Next stock-out · ${sm.nextStockOut.label}` : "Next stock-out", sm?.nextStockOut ? dateShort(sm.nextStockOut.at) : "None", "text-amber-300"],
            [IndianRupee, "Usable stock value", sm ? rs(sm.stockValueRs) : "—", "text-emerald-300"],
            [ClipboardList, "Open purchase requests", sm?.openPrs ?? "—", "text-sky-300"],
          ].map(([Icon, l, v, cls]) => (
            <div key={l} className="rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3">
              <Icon size={16} className="text-white/40 mb-1" />
              <p className={clsx("text-xl font-black tabular-nums truncate", cls)}>{v}</p>
              <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold leading-tight">{l}</p>
            </div>
          ))}
        </div>
        {data && <p className="relative mt-4 text-[11px] text-white/50">Service level {Math.round(data.settings.serviceLevel * 100)}% (z = {data.settings.z}) · smoothing α = {data.settings.alpha} · forecast horizon {data.settings.horizonDays} days · planned heats from the Pre-Melt Gate · suppliers from the Supplier Scorecard</p>}
      </div>

      {loading && !data ? (
        <div className="rounded-2xl border border-metal-200 bg-white shadow-metal"><MeltSpinner label="Forecasting stock…" sublabel="Consumption history, planned heats, safety stock and reorder points" /></div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-metal-500 mb-3">Ferro-alloys — a stock-out stops chemistry corrections</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {alloys.map((i) => {
                const s = STATUS[i.status] || STATUS.NO_DEMAND;
                return (
                  <div key={i.item} role="button" tabIndex={0} onClick={() => openDetail(i.item)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openDetail(i.item); } }}
                    className={clsx("cursor-pointer text-left rounded-2xl border-2 bg-white p-5 shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-500", s.soft)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-black text-metal-900">{i.label}</p>
                        <p className="text-[11px] text-metal-500">{i.note} · lead time {i.leadDays} days</p>
                      </div>
                      <StatusChip status={i.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                      <CoverGauge days={i.coverDays} lead={i.leadDays} status={i.status} />
                      <dl className="text-sm space-y-1 flex-1">
                        <div className="flex justify-between"><dt className="text-metal-500">Usable</dt><dd className="font-bold tabular-nums">{kgs(i.usableKg)}</dd></div>
                        <div className="flex justify-between"><dt className="text-metal-500">Daily use</dt><dd className="font-bold tabular-nums">{n(i.dailyDemandKg, 1)} kg</dd></div>
                        <div className="flex justify-between"><dt className="text-metal-500">Reorder point</dt><dd className="font-bold tabular-nums">{kgs(i.reorderPointKg)}</dd></div>
                        <div className="flex justify-between"><dt className="text-metal-500">Stock-out</dt><dd className={clsx("font-bold tabular-nums", s.text)}>{i.stockOutAt ? dateShort(i.stockOutAt) : "—"}</dd></div>
                      </dl>
                    </div>
                    <p className={clsx("text-xs mt-3 min-h-[2rem]", s.text)}>{i.statusReason}</p>
                    <div className="mt-2">{actionFor(i, true)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <Card title="Charge materials — a stock-out means no heat can be planned">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[980px]">
                <thead><tr className="text-left text-xs text-metal-500 border-b border-metal-200">
                  <th className="px-2 py-2">Item</th><th className="px-2 text-right">Usable</th><th className="px-2 text-right">Daily use</th><th className="px-2 w-48">Days of cover</th>
                  <th className="px-2 text-right">Reorder point</th><th className="px-2">Status</th><th className="px-2">Stock-out</th><th className="px-2 text-right">Action</th>
                </tr></thead>
                <tbody>
                  {charge.map((i) => {
                    const s = STATUS[i.status] || STATUS.NO_DEMAND;
                    const pct = i.coverDays === null ? 0 : Math.min(100, (i.coverDays / 30) * 100);
                    const leadPct = Math.min(100, ((i.leadDays + 1) / 30) * 100);
                    return (
                      <tr key={i.item} onClick={() => openDetail(i.item)} className="border-b border-metal-100 cursor-pointer hover:bg-primary-50/40">
                        <td className="px-2 py-3">
                          <p className="font-semibold text-metal-900">{i.label}</p>
                          {i.warnings?.[0] && <p className="text-[11px] text-amber-700 max-w-xs truncate" title={i.warnings[0].text}>⚠ {i.warnings[0].text}</p>}
                        </td>
                        <td className="px-2 text-right tabular-nums">
                          <b>{kgs(i.usableKg)}</b>
                          {i.notUsableKg > 0 && <span className="block text-[11px] text-metal-400">+ {kgs(i.notUsableKg)} not usable</span>}
                        </td>
                        <td className="px-2 text-right tabular-nums">{n(i.dailyDemandKg, 0)} kg<span className="block text-[10.5px] text-metal-400">{i.demandBasis === "planned" ? "planned heats" : i.demandBasis === "history" ? "smoothed history" : ""}</span></td>
                        <td className="px-2">
                          <div className="relative h-2.5 rounded-full bg-metal-100 overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-red-100" style={{ width: `${leadPct}%` }} />
                            <div className={clsx("absolute inset-y-0 left-0 rounded-full", s.bar)} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[11px] text-metal-500 mt-0.5 tabular-nums">{i.coverDays === null ? "no demand" : `${n(i.coverDays, 1)} days`} · lead {i.leadDays} d</p>
                        </td>
                        <td className="px-2 text-right tabular-nums">{i.inHouse ? "—" : kgs(i.reorderPointKg)}</td>
                        <td className="px-2"><StatusChip status={i.status} /></td>
                        <td className={clsx("px-2 tabular-nums text-xs font-semibold", s.text)}>{i.stockOutAt ? dateShort(i.stockOutAt) : "—"}</td>
                        <td className="px-2 text-right">{actionFor(i, false)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title={<span className="inline-flex items-center gap-2"><ClipboardList size={16} className="text-sky-600" />Purchase requests</span>}>
            {prs.length === 0 ? <p className="text-sm text-metal-500 py-4 text-center">No purchase requests yet. Create one from an item that needs reordering.</p> : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm min-w-[960px]">
                  <thead><tr className="text-left text-xs text-metal-500 border-b border-metal-200">
                    <th className="px-2 py-2">PR</th><th className="px-2">Item</th><th className="px-2 text-right">Quantity</th><th className="px-2">Supplier</th><th className="px-2 text-right">Est. ₹</th>
                    <th className="px-2">Status</th><th className="px-2">Requested by</th><th className="px-2 text-right">Action</th>
                  </tr></thead>
                  <tbody>
                    {prs.map((p) => (
                      <tr key={p.prId} className="border-b border-metal-100 align-top">
                        <td className="px-2 py-2.5 font-mono font-bold">{p.prId}<span className="block text-[10.5px] font-sans font-normal text-metal-400">{new Date(p.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></td>
                        <td className="px-2">{p.label}<span className="block text-[11px] text-metal-400 max-w-[16rem] truncate" title={p.reason}>{p.reason}</span></td>
                        <td className="px-2 text-right tabular-nums font-semibold">{kgs(p.qtyKg)}</td>
                        <td className="px-2"><span className="inline-flex items-center gap-1.5"><GradeBadge grade={p.supplierGrade} small />{p.supplier || "—"}</span></td>
                        <td className="px-2 text-right tabular-nums">{rs(p.estTotalRs)}</td>
                        <td className="px-2">
                          <span className={clsx("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold", PR_STATUS[p.status])}>{p.status.replace("_", " ").toLowerCase()}</span>
                          {p.approvedBy && <span className="block text-[10.5px] text-metal-400">by {p.approvedBy}</span>}
                          {p.rejectReason && <span className="block text-[10.5px] text-red-600">{p.rejectReason}</span>}
                          {p.linkedLotId && <span className="block text-[10.5px] text-emerald-700">→ {p.linkedLotId}</span>}
                        </td>
                        <td className="px-2 text-metal-600">{p.requestedBy}</td>
                        <td className="px-2 text-right whitespace-nowrap">
                          {p.status === "PENDING_APPROVAL" && (
                            <span className="inline-flex gap-1.5">
                              <Button size="sm" onClick={() => setAct({ pr: p, mode: "approve" })}><Check size={13} className="mr-1" />Approve</Button>
                              <Button size="sm" variant="ghost" onClick={() => setAct({ pr: p, mode: "reject" })}>Reject</Button>
                            </span>
                          )}
                          {p.status === "APPROVED" && (
                            <Button size="sm" variant="outline" onClick={() => navigate(`/raw-material-stock?pr=${p.prId}`)}><Truck size={13} className="mr-1" />Receive truck<ArrowRight size={12} className="ml-1" /></Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="text-xs text-metal-500">
            Usable stock = released lots + restricted lots up to their charge limit. Daily demand = the larger of the exponentially smoothed use (last 30 days) and the planned heats' need over the horizon.
            Safety stock = z × σ × √lead time; reorder point = daily demand × lead time + safety stock; order quantity = EOQ, at least the minimum order and the shortfall. Planned heats above the normal run-rate come off the stock first.
          </p>
        </>
      )}

      {detail && <ItemDetail key={detail} itemKey={detail} onClose={() => openDetail(null)} onCreatePr={(d) => setPrFor(d)} />}
      {prFor && <CreatePrDialog item={prFor} onClose={() => setPrFor(null)} onCreated={() => { const k = detail; setPrFor(null); setDetail(null); load().then(() => k && setDetail(k)); }} />}
      {act && <ApproveDialog pr={act.pr} mode={act.mode} onClose={() => setAct(null)} onDone={() => { setAct(null); load(); }} />}
    </div>
  );
}
