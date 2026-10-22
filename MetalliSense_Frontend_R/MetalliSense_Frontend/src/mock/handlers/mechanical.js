const STANDARDS = {
  "LOW-CARBON-STEEL":    { uts_min: 370, ys_min: 230, elong_min: 20, hb_max: 200, ce_max: 0.42, sp_max: 0.080, ref: "IS 2062 E250" },
  "MEDIUM-CARBON-STEEL": { uts_min: 550, ys_min: 300, elong_min: 10, hb_max: 320, ce_max: 0.65, sp_max: 0.080, ref: "IS 1570 C30-C60" },
  "HIGH-CARBON-STEEL":   { uts_min: 650, ys_min: 350, elong_min: 5,  hb_max: 380, ce_max: null, sp_max: 0.070, ref: "IS 1570 C60-C100" },
  "GREY-IRON":           { uts_min: 200, ys_min: null, elong_min: null, hb_max: 280, ce_max: null, sp_max: null, ref: "IS 210 FG 200" },
  "SG-IRON":             { uts_min: 400, ys_min: 250, elong_min: 10, hb_max: 280, ce_max: null, sp_max: 0.085, ref: "IS 1865 SG 400/10" },
};


function predictFromChemistry(grade, C, Si, Mn, P, S) {
  const isSteel = grade.includes("STEEL");
  const isGrey = grade === "GREY-IRON";
  let uts, ys, elong, hb, ce, contributions = null;

  if (isSteel) {
    ce = C + Mn / 6;
    uts = 294 + 838 * C - 452 * C * C + 276 * Mn + 80 * Si + 950 * P;
    if (grade === "HIGH-CARBON-STEEL" && C > 0.8) uts *= 0.85 + 0.15 * Math.exp(-(C - 0.8) * 3);
    uts = Math.max(uts, 280);
    ys = 160 + 40 * Mn + 80 * Si + 1000 * P + 500 * C * (1 - 0.5 * C);
    if (ys >= uts * 0.92) ys = uts * 0.62;
    ys = Math.min(ys, uts * 0.9);
    elong = 45 - 35 * C - 12 * C * C - 5 * ce - 120 * S;
    if (grade === "HIGH-CARBON-STEEL" && C > 0.6) elong = Math.max(elong, 12 - 5 * (C - 0.6));
    elong = Math.max(2, Math.min(45, elong));
    hb = uts / 3.45;
    const cC = 838 * C - 452 * C * C, mC = 276 * Mn, sC = 80 * Si, pC = 950 * P, bC = 294;
    const tot = bC + cC + mC + sC + pC;
    contributions = {
      base_ferrite: { mpa: Math.round(bC), pct: +(bC / tot * 100).toFixed(1) },
      C: { mpa: Math.round(cC), pct: +(cC / tot * 100).toFixed(1) },
      Mn: { mpa: Math.round(mC), pct: +(mC / tot * 100).toFixed(1) },
      Si: { mpa: Math.round(sC), pct: +(sC / tot * 100).toFixed(1) },
      P: { mpa: Math.round(pC), pct: +(pC / tot * 100).toFixed(1) },
    };
  } else if (isGrey) {
    ce = C + Si / 3 + P / 3;
    uts = Math.max(100, Math.min(400, 880 - 125 * ce + 35 * Mn - 300 * Math.max(S - 0.05, 0)));
    ys = uts * 0.72;
    elong = 0.5;
    hb = Math.max(130, Math.min(300, 100 + 35 * (4.5 - ce) + 20 * Mn));
    contributions = { note: "Cast iron: strength is matrix + graphite morphology controlled." };
  } else {
    // SG-IRON
    ce = C + Si / 3 + P / 3;
    let pf = Math.max(0, Math.min(1, 0.15 + 0.45 * Mn - 0.15 * Si));
    uts = (370 + 40 * Si) * (1 - pf) + (650 + 50 * Mn) * pf;
    if (P > 0.05) uts -= 500 * (P - 0.05);
    if (S > 0.02) uts -= 800 * (S - 0.02);
    uts = Math.max(300, Math.min(800, uts));
    ys = uts * (0.65 - 0.1 * pf);
    elong = Math.max(1, Math.min(25, 22 - 18 * pf + 1.5 * Si - 200 * Math.max(P - 0.03, 0)));
    hb = Math.max(130, Math.min(320, 130 + 120 * pf + 15 * Si));
    contributions = { note: `SG Iron: Pearlite ≈ ${Math.round(pf * 100)}%. Si promotes ferrite (ductile), Mn promotes pearlite (strong).` };
  }

  // Quality checks
  const std = STANDARDS[grade] || {};
  const sp = P + S;
  const alerts = [];
  let qr = "PASS";
  if (std.uts_min && uts < std.uts_min) { alerts.push({ property: "UTS", message: `UTS ${uts.toFixed(0)} MPa below minimum ${std.uts_min} MPa`, severity: "HIGH" }); qr = "FAIL"; }
  if (std.ys_min && ys < std.ys_min) { alerts.push({ property: "YS", message: `YS ${ys.toFixed(0)} MPa below minimum ${std.ys_min} MPa`, severity: "HIGH" }); qr = "FAIL"; }
  if (std.elong_min && elong < std.elong_min) { alerts.push({ property: "Elongation", message: `Elongation ${elong.toFixed(1)}% below minimum ${std.elong_min}%`, severity: "HIGH" }); qr = "FAIL"; }
  if (std.hb_max && hb > std.hb_max) { alerts.push({ property: "Hardness", message: `Hardness ${hb.toFixed(0)} HB above max ${std.hb_max} HB`, severity: "MEDIUM" }); }
  if (std.ce_max && ce > std.ce_max) { alerts.push({ property: "CE", message: `Carbon equivalent ${ce.toFixed(3)} exceeds limit ${std.ce_max}`, severity: "HIGH" }); qr = "FAIL"; }
  if (std.sp_max && sp > std.sp_max) { alerts.push({ property: "S+P", message: `S+P = ${sp.toFixed(4)} exceeds limit ${std.sp_max}`, severity: "HIGH" }); qr = "FAIL"; }
  if (isSteel && ce > 0.40) { alerts.push({ property: "Weldability", message: `CE ${ce.toFixed(3)} above 0.40 — weldability reduced`, severity: "MEDIUM" }); }
  if (grade === "SG-IRON" && S > 0.025) { alerts.push({ property: "Nodularity", message: `S = ${S} above 0.025 — nodularity risk`, severity: "MEDIUM" }); }
  if (!alerts.length) alerts.push({ property: "All", message: "All mechanical properties within expected range", severity: "NONE" });

  // CE budget
  const ceBudget = isSteel
    ? { C: { value: C, contribution: +C.toFixed(4), share_pct: Math.round(C / ce * 100) }, "Mn/6": { value: Mn, contribution: +(Mn / 6).toFixed(4), share_pct: Math.round(Mn / 6 / ce * 100) } }
    : { C: { value: C, contribution: +C.toFixed(4), share_pct: Math.round(C / ce * 100) }, "Si/3": { value: Si, contribution: +(Si / 3).toFixed(4), share_pct: Math.round(Si / 3 / ce * 100) }, "P/3": { value: P, contribution: +(P / 3).toFixed(4), share_pct: Math.round(P / 3 / ce * 100) } };

  return {
    grade, material_family: isSteel ? "steel" : "cast_iron",
    predicted_uts_mpa: Math.round(uts * 10) / 10,
    predicted_ys_mpa: Math.round(ys * 10) / 10,
    predicted_elongation_pct: Math.round(elong * 10) / 10,
    predicted_hardness_hb: Math.round(hb),
    uts_ys_ratio: ys > 0 ? Math.round(uts / ys * 1000) / 1000 : null,
    carbon_equivalent: Math.round(ce * 10000) / 10000,
    ce_budget: ceBudget,
    element_contributions: contributions,
    quality_result: qr,
    alerts,
    reference_standard: std.ref || grade,
  };
}


export { STANDARDS, predictFromChemistry };