const PILLAR_KEYS=['quality','cost','delivery','service'];
const RI={4:.9};
export function ahpLocal(j) {
  const A = PILLAR_KEYS.map(() => PILLAR_KEYS.map(() => 1));
  PILLAR_KEYS.forEach((a, i) => PILLAR_KEYS.forEach((b, k) => {
    if (i >= k) return;
    const v = Number(j[`${a}:${b}`]) || 1;
    A[i][k] = v;
    A[k][i] = 1 / v;
  }));
  const n = PILLAR_KEYS.length;
  const gm = A.map((row) => row.reduce((p, x) => p * x, 1) ** (1 / n));
  const sum = gm.reduce((a, b) => a + b, 0);
  const w = gm.map((g) => g / sum);
  const Aw = A.map((row) => row.reduce((s, x, k) => s + x * w[k], 0));
  const lambda = Aw.reduce((s, v, i) => s + v / w[i], 0) / n;
  const CR = (lambda - n) / (n - 1) / RI[n];
  return { w, CR, lambda };
}
