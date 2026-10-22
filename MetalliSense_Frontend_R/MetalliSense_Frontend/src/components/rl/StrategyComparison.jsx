import React, { useMemo } from "react";
import clsx from "clsx";
import { Trophy, Scale, Sparkles, Leaf, IndianRupee, Target, Gauge, ShieldAlert, Crown } from "lucide-react";
import ReadAloud from "../common/ReadAloud";

/**
 * Side-by-side comparison of the RL strategies (conservative / balanced /
 * aggressive). Works identically for synthetic readings and for a heat
 * coming from the Pre-Melt Gate.
 *
 * Composite score (0–100) = 35% predicted reward + 25% correction cost
 * + 25% spec compliance + 15% carbon — each min-max normalised across
 * the candidates so the best on every axis scores 100 on that axis.
 */
const STRATEGY_META = {
  conservative: { label: "Conservative", tone: "sky", blurb: "Smallest additions · lowest risk of overshoot" },
  balanced: { label: "Balanced", tone: "emerald", blurb: "Full model correction · best trade-off" },
  aggressive: { label: "Aggressive", tone: "amber", blurb: "Over-corrects · fastest pull into spec" },
};
const TONE = {
  sky: { chip: "bg-sky-100 text-sky-800 ring-sky-200", bar: "bg-sky-500", head: "from-sky-50" },
  emerald: { chip: "bg-emerald-100 text-emerald-800 ring-emerald-200", bar: "bg-emerald-500", head: "from-emerald-50" },
  amber: { chip: "bg-amber-100 text-amber-800 ring-amber-200", bar: "bg-amber-500", head: "from-amber-50" },
};

const norm = (vals, higherIsBetter) => {
  const min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 1e-9) return vals.map(() => 1);
  return vals.map((v) => (higherIsBetter ? (v - min) / (max - min) : (max - v) / (max - min)));
};
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function buildComparison(candidates, { composition = {}, spec = {}, mechFor }) {
  const rows = candidates.map((c) => {
    const adds = c.recommended_additions || {};
    const els = Object.keys(spec);
    let inSpecAfter = 0, inSpecBefore = 0;
    els.forEach((el) => {
      const [lo, hi] = spec[el];
      const b = composition[el] ?? 0, a = b + (adds[el] || 0);
      if ((lo == null || b >= lo) && (hi == null || b <= hi)) inSpecBefore++;
      if ((lo == null || a >= lo) && (hi == null || a <= hi)) inSpecAfter++;
    });
    const mech = mechFor ? mechFor(c) : null;
    return {
      c,
      strategy: c.strategy,
      reward: c.predicted_reward ?? 0,
      cost: c.estimatedCost?.totalAdditionsCost ?? c.estimated_cost ?? 0,
      co2: c.estimatedCarbon?.totalAdditionsCo2Kg ?? 0,
      batchCost: c.estimatedCost?.totalBatchCost ?? null,
      savings: c.savingsPerTon ?? null,
      specTotal: els.length,
      inSpecBefore,
      inSpecAfter,
      mechPass: mech ? mech.pass : null,
      violations: Object.keys(c.constraint_violations || {}).length,
      nAdds: Object.keys(adds).length,
    };
  });
  const nR = norm(rows.map((r) => r.reward), true);
  const nC = norm(rows.map((r) => r.cost), false);
  const nS = norm(rows.map((r) => (r.specTotal ? r.inSpecAfter / r.specTotal : 0) + (r.mechPass === false ? -0.5 : 0)), true);
  const nX = norm(rows.map((r) => r.co2), false);
  rows.forEach((r, i) => {
    r.composite = Math.round(100 * (0.35 * nR[i] + 0.25 * nC[i] + 0.25 * nS[i] + 0.15 * nX[i]) - r.violations * 10);
    r.composite = Math.max(0, Math.min(100, r.composite));
  });
  const best = (key, higher) => rows.reduce((b, r) => (higher ? r[key] > b[key] : r[key] < b[key]) ? r : b, rows[0]).strategy;
  return {
    rows,
    winners: {
      reward: best("reward", true),
      cost: best("cost", false),
      co2: best("co2", false),
      composite: best("composite", true),
      spec: best("inSpecAfter", true),
    },
  };
}

export function comparisonSpeech({ rows, winners }, { heatId, grade, source }) {
  const pick = rows.find((r) => r.strategy === winners.composite);
  const parts = [
    `Adaptive strategy comparison for ${heatId ? `heat ${heatId.split("").join(" ")}, ` : ""}grade ${String(grade || "").replace(/-/g, " ").toLowerCase()}.`,
    source === "gate" ? "Composition comes from the pre-melt gate prediction." : "",
    ...rows.map((r) => `${STRATEGY_META[r.strategy]?.label || r.strategy}: composite score ${r.composite}, predicted reward ${r.reward.toFixed(2)}, correction cost ${Math.round(r.cost)} rupees, ${r.inSpecAfter} of ${r.specTotal} elements in spec${r.mechPass === false ? ", mechanical properties fail" : ""}.`),
    pick ? `Recommended: the ${STRATEGY_META[pick.strategy]?.label.toLowerCase()} strategy, with the best overall score of ${pick.composite}. Operator approval is required before any addition.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

function Bar({ value, max, tone, win }) {
  const w = max > 0 ? Math.max(4, (Math.abs(value) / max) * 100) : 4;
  return (
    <div className="h-1.5 w-full rounded-full bg-metal-100 overflow-hidden mt-1.5">
      <div className={clsx("h-full rounded-full transition-all duration-700", win ? TONE[tone].bar : "bg-metal-300")} style={{ width: `${w}%` }} />
    </div>
  );
}

export default function StrategyComparison({ comparison, heatId, grade, source, onPick }) {
  const { rows, winners } = comparison;
  const maxOf = (k) => Math.max(...rows.map((r) => Math.abs(r[k] || 0)));
  const speech = useMemo(() => comparisonSpeech(comparison, { heatId, grade, source }), [comparison, heatId, grade, source]);

  const METRICS = [
    { key: "composite", label: "Composite score", icon: Trophy, win: winners.composite, fmt: (r) => <span className="text-2xl font-black tabular-nums">{r.composite}<span className="text-xs font-semibold text-metal-400">/100</span></span>, bar: true, hint: "Reward 35% · Cost 25% · Spec 25% · CO₂ 15%" },
    { key: "reward", label: "Predicted reward", icon: Sparkles, win: winners.reward, fmt: (r) => <span className="font-bold tabular-nums">{r.reward.toFixed(3)}</span>, bar: true, hint: "Learned from operator feedback" },
    { key: "spec", label: "Spec compliance", icon: Target, win: winners.spec, fmt: (r) => <span className="font-bold tabular-nums">{r.inSpecAfter}/{r.specTotal} <span className="text-xs font-medium text-metal-400">(was {r.inSpecBefore})</span></span>, hint: "Elements inside grade limits after correction" },
    { key: "cost", label: "Correction cost", icon: IndianRupee, win: winners.cost, fmt: (r) => <span className="font-bold tabular-nums">{inr(r.cost)}</span>, hint: "Additions + handling premium" },
    { key: "co2", label: "Added CO₂", icon: Leaf, win: winners.co2, fmt: (r) => <span className="font-bold tabular-nums">{r.co2.toFixed(1)} <span className="text-xs font-medium text-metal-400">kg</span></span>, hint: "From ferro-alloy additions" },
    { key: "mech", label: "Mechanical props", icon: Gauge, fmt: (r) => r.mechPass == null ? <span className="text-metal-400">—</span> : r.mechPass ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">PASS</span> : <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">FAIL</span>, hint: "Predicted UTS / YS / elongation vs standard" },
    { key: "violations", label: "Constraint flags", icon: ShieldAlert, fmt: (r) => r.violations ? <span className="font-bold text-red-600">{r.violations}</span> : <span className="font-semibold text-emerald-600">None</span>, hint: "Hard manufacturing limits" },
  ];

  return (
    <div className="rounded-2xl border border-metal-200 bg-white shadow-metal overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gradient-to-r from-metal-900 via-metal-800 to-primary-900 text-white">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/20"><Scale size={18} /></div>
          <div>
            <p className="font-bold leading-tight">Strategy comparison</p>
            <p className="text-xs text-white/60">
              {source === "gate" ? <>Pre-Melt Gate composition{heatId ? ` · Heat ${heatId}` : ""}</> : "Manual / synthetic reading"} · {grade}
            </p>
          </div>
        </div>
        <ReadAloud text={speech} label="Read comparison" variant="dark" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              <th className="w-56 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-metal-400 bg-metal-50/60">Metric</th>
              {rows.map((r) => {
                const m = STRATEGY_META[r.strategy] || { label: r.strategy, tone: "emerald", blurb: "" };
                const top = r.strategy === winners.composite;
                return (
                  <th key={r.strategy} className={clsx("px-4 py-3 text-left align-top bg-gradient-to-b to-white", TONE[m.tone].head, top && "ring-2 ring-inset ring-primary-400")}>
                    <div className="flex items-center gap-2">
                      <span className={clsx("px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide ring-1", TONE[m.tone].chip)}>{m.label}</span>
                      {top && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded"><Crown size={10} />Best overall</span>}
                    </div>
                    <p className="mt-1 text-[11px] font-normal text-metal-500">{m.blurb}</p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((mt) => (
              <tr key={mt.key} className={clsx("border-t border-metal-100", mt.key === "composite" && "bg-primary-50/30")}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 font-semibold text-metal-800"><mt.icon size={14} className="text-metal-400" />{mt.label}</div>
                  <p className="text-[11px] text-metal-400 mt-0.5">{mt.hint}</p>
                </td>
                {rows.map((r) => {
                  const tone = (STRATEGY_META[r.strategy] || {}).tone || "emerald";
                  const win = mt.win && mt.win === r.strategy;
                  return (
                    <td key={r.strategy} className={clsx("px-4 py-3 align-middle", r.strategy === winners.composite && "bg-primary-50/40")}>
                      <div className="flex items-center gap-2 text-metal-900">
                        {mt.fmt(r)}
                        {win && mt.key !== "composite" && <span className="text-[10px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded">BEST</span>}
                      </div>
                      {mt.bar && <Bar value={r[mt.key]} max={maxOf(mt.key)} tone={tone} win={win} />}
                    </td>
                  );
                })}
              </tr>
            ))}
            {onPick && (
              <tr className="border-t border-metal-100 bg-metal-50/60">
                <td className="px-5 py-3 text-[11px] text-metal-500">Operator decision required — nothing is applied automatically.</td>
                {rows.map((r) => (
                  <td key={r.strategy} className="px-4 py-3">
                    <button type="button" onClick={() => onPick(r.strategy)} className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2">
                      View details ↑
                    </button>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
