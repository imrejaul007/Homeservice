/**
 * Parse API errors from AuthService (message or "message — field: detail; ...").
 */
export function parseApiValidationError(error: unknown): {
  submit: string;
  fields: Record<string, string>;
} {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  const fields: Record<string, string> = {};

  const separator = ' — ';
  const idx = message.indexOf(separator);
  if (idx === -1) {
    return { submit: message, fields };
  }

  const submit = message.slice(0, idx).trim();
  const detailsPart = message.slice(idx + separator.length);
  detailsPart.split(';').forEach((part) => {
    const colon = part.indexOf(':');
    if (colon === -1) return;
    const field = part.slice(0, colon).trim();
    const detail = part.slice(colon + 1).trim();
    if (field) fields[field] = detail;
  });

  return { submit: submit || message, fields };
}
