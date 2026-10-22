/**
 * GateBanner
 *
 * Shown at the top of every AI page (Anomaly, Alloy, RL) when the
 * Pre-Melt Gate has not yet been cleared for the current heat.
 * If the gate has passed it shows the heat summary instead.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, AlertTriangle, ArrowRight, Flame } from 'lucide-react';
import { useMeltFlow } from '../../context/MeltFlowContext';

const STEP_NAMES = {
  anomaly: 'Composition Deviation Analysis',
  alloy: 'Melt Correction Planner',
  rl: 'Adaptive Strategy Optimizer',
  mech: 'Mechanical Properties',
};

const PREREQ = {
  anomaly: null,
  alloy: 'anomaly',
  rl: 'alloy',
  mech: 'rl',
};

export default function GateBanner({ page }) {
  const nav = useNavigate();
  const { flow, isUnlocked, canRunAnomaly, canRunAlloy, canRunRL, canRunMech } = useMeltFlow();
  const canRun = { anomaly: canRunAnomaly, alloy: canRunAlloy, rl: canRunRL, mech: canRunMech };

  // ── Not unlocked yet ──────────────────────────────────────────────────
  if (!isUnlocked) {
    return (
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5 mb-6 flex flex-wrap gap-4 items-start">
        <Lock className="text-amber-600 mt-0.5 shrink-0" size={22} />
        <div className="flex-1">
          <p className="font-bold text-amber-900 text-base">
            {STEP_NAMES[page]} is locked until a heat passes the Pre-Melt Gate
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Complete the flow in order: receive raw material → yard inspection →
            DRI lab → Pre-Melt Gate. Once the furnace starts the gate's predicted
            composition is automatically passed here — no synthetic data needed.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => nav('/raw-material-stock')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-amber-200 text-amber-900 hover:bg-amber-300"
            >
              Raw Material Stock <ArrowRight size={13} />
            </button>
            <button
              onClick={() => nav('/premelt-gate')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
            >
              <ShieldCheck size={14} /> Go to Pre-Melt Gate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Unlocked but prerequisite step not done yet ────────────────────────
  const prereq = PREREQ[page];
  if (prereq && !canRun[page]) {
    const prereqName = STEP_NAMES[prereq];
    const prereqPath = { anomaly: '/anomaly', alloy: '/recommendation', rl: '/rl-optimizer', mech: '/full-analysis' }[prereq];
    return (
      <div className="rounded-xl border-2 border-sky-200 bg-sky-50 p-5 mb-6 flex flex-wrap gap-4 items-start">
        <AlertTriangle className="text-sky-600 mt-0.5 shrink-0" size={22} />
        <div className="flex-1">
          <p className="font-bold text-sky-900">
            Complete {prereqName} first
          </p>
          <p className="text-sm text-sky-800 mt-1">
            Heat <strong>{flow.heatId}</strong> ({flow.grade}) has passed the gate. Run{' '}
            {prereqName} before coming here.
          </p>
          <button
            onClick={() => nav(prereqPath)}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700"
          >
            Go to {prereqName} <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  // ── Unlocked and ready ─────────────────────────────────────────────────
  const decision = flow.gateDecision;
  const decisionCls = decision === 'GO'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
    : decision === 'WARN'
    ? 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-red-300 bg-red-50 text-red-900';

  return (
    <div className={`rounded-xl border-2 p-4 mb-6 ${decisionCls}`}>
      <div className="flex flex-wrap gap-3 items-center">
        <Flame size={18} className="shrink-0" />
        <span className="font-bold">Heat {flow.heatId} is melting</span>
        <span className="text-sm opacity-80">
          {flow.grade} · {flow.chargeKg ? `${Math.round(flow.chargeKg)} kg charged → ${Math.round(flow.metalKg)} kg metal` : ''}
        </span>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
          decision === 'GO' ? 'bg-emerald-600 text-white' : decision === 'WARN' ? 'bg-amber-500 text-black' : 'bg-red-700 text-white'
        }`}>
          Gate: {decision}{flow.overriddenBy ? ` (overridden by ${flow.overriddenBy})` : ''}
        </span>
      </div>
      <p className="text-xs opacity-75 mt-2">
        Composition from gate prediction — {flow.gateId} · cleared at {flow.passedAt ? new Date(flow.passedAt).toLocaleTimeString() : '—'}
      </p>
      {flow.stockStatus === 'deducted' && (
        <p className="text-xs font-semibold mt-1">
          ✅ Stock deducted — accepted strategy: {flow.acceptedStrategy?.strategy}
        </p>
      )}
    </div>
  );
}
