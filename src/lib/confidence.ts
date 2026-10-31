// Part 2: a blended, explainable conflict confidence.
//   confidence = w1*agreement + w2*cosine_norm + w3*rule_signal
// agreement   = fraction of N self-consistency samples that said CONTRADICTS
// cosine_norm = semantic closeness of new vs matched prior statement (optional)
// rule_signal = deterministic topic rule (e.g. deadline moved later)
// Missing signals are dropped and the remaining weights renormalised.
// TODO(calibration): fit Platt/isotonic on verdict_logs (confidence, final
// verdict) so a displayed 85% means ~85% confirmed. Not done yet — the score is
// a blend, NOT a calibrated probability.

const num = (v: string | undefined, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? Math.min(hi, Math.max(lo, n)) : d;
};

export function confidenceConfig(env: Record<string, string | undefined> = process.env) {
  return {
    /** Blend on/off. Off = legacy single self-reported confidence. */
    blend: env.FLAG_CONFIDENCE_BLEND === "true",
    /** Self-consistency samples per verify (each counts against the daily cap). */
    samples: Math.round(num(env.CONF_SAMPLES, 3, 1, 5)),
    temperature: num(env.CONF_SAMPLE_TEMPERATURE, 0.4, 0, 1),
    /** >= red objection; [maybeFloor, threshold) grey "maybe"; below: suppressed. */
    threshold: num(env.CONF_THRESHOLD, 0.85, 0.05, 1),
    maybeFloor: num(env.CONF_MAYBE_FLOOR, 0.4, 0, 1),
    useEmbeddings: env.CONF_USE_EMBEDDINGS === "true",
    weights: {
      agreement: num(env.CONF_W_AGREEMENT, 0.6, 0, 1),
      cosine: num(env.CONF_W_COSINE, 0.25, 0, 1),
      rule: num(env.CONF_W_RULE, 0.15, 0, 1),
    },
  };
}

export interface Signals {
  agreement: number | null;
  cosine: number | null; // raw cosine similarity -1..1
  rule: number | null; // 0..1
}

/** Map raw cosine (embedding models put unrelated text ~0.5) to 0..1. */
export const cosineNorm = (c: number) => Math.min(1, Math.max(0, (c - 0.5) / 0.5));

export function blendConfidence(s: Signals, w = confidenceConfig().weights): number {
  const parts: [number, number][] = [];
  if (s.agreement !== null) parts.push([w.agreement, s.agreement]);
  if (s.cosine !== null) parts.push([w.cosine, cosineNorm(s.cosine)]);
  if (s.rule !== null) parts.push([w.rule, s.rule]);
  const total = parts.reduce((a, [wt]) => a + wt, 0);
  if (!total) return 0;
  return Math.min(1, Math.max(0, parts.reduce((a, [wt, v]) => a + wt * v, 0) / total));
}

export type Tier = "red" | "maybe" | "suppressed";
export function tierFor(conf: number, cfg = confidenceConfig()): Tier {
  if (conf >= cfg.threshold) return "red";
  return conf >= cfg.maybeFloor ? "maybe" : "suppressed";
}

const TIME_TOPICS = new Set(["deadline", "submission", "launch-date"]);
/** Deterministic rule signal; null when no rule applies to the topic. */
export function ruleSignal(topic: string, newText: string, priorText: string): number | null {
  const n = newText.toLowerCase();
  if (TIME_TOPICS.has(topic)) {
    if (/tomorrow|next (day|week)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|postpone|delay|push(ed)? (it )?back|later/.test(n)) return 1;
    if (/tonight|today|\b\d{1,2}(:\d{2})?\s*(am|pm)\b|midnight|earlier|sooner/.test(n)) return 0.2; // same-day / tighter
    return null;
  }
  const negation = /\b(no|not|don't|dont|never|instead|switch|drop|cancel|scrap|replace|rather)\b/;
  if (negation.test(n) && !negation.test(priorText.toLowerCase())) return 0.8;
  return null;
}

export function cosine(a: number[], b: number[]): number | null {
  if (!a.length || a.length !== b.length) return null;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : null;
}
