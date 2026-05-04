"use client";

// This is a thin re-export — the dashboard layout mounts this component,
// which renders the context-aware floating widget on every page.
// The actual widget is in ZicaAIWidget.tsx.

import ZicaAIWidget from "./ZicaAIWidget";

export default function ZicaAI() {
  return <ZicaAIWidget />;
}
