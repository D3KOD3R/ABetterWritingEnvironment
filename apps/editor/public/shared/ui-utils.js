// Intent: provide tiny browser-safe formatting helpers shared across editor feature modules.
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatDisplayNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value ?? "");
  }

  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(number));
}
