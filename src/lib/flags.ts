// Feature flags — all OFF by default. Flip in .dev.vars/.env.local (and as a
// Worker secret) to enable an experiment without changing default behavior.
export const flags = {
  // #1: gate red cards on a confidence score; show a grey "maybe" below 0.85.
  confidence: process.env.FLAG_CONFIDENCE === "true",
  // #2: extra fintech demo project + per-project demo clip + keywords.
  fintech: process.env.FLAG_FINTECH === "true",
  // #3: polite card phrasing ("Heads up: on <date> you decided …").
  politeCards: process.env.NEXT_PUBLIC_FLAG_POLITE_CARDS === "true",
  // #4: log every verdict click to a table (logging only).
  logVerdicts: process.env.FLAG_LOG_VERDICTS === "true",
};

export const CONFIDENCE_THRESHOLD = 0.85;
