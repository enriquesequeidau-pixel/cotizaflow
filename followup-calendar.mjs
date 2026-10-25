/*
 * CotizaFlow Pro v2 — offline, side-effect-free ICS export for follow-ups.
 * This is not a reminder sender or an entitlement check. The caller must
 * verify Pro server-side before exposing the export; no data is transmitted.
 * All-day dates intentionally preserve the user's Chilean calendar day across
 * DST changes rather than converting local dates to UTC timestamps.
 */
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const NAMESPACE = /^[A-Za-z0-9_-]{1,64}$/;
const STATUSES = new Set(['borrador', 'enviada', 'aceptada', 'rechazada']);
const encoder = new TextEncoder();

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function nextDate(value) {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
function checkedText(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) {
    throw new TypeError(`${label} inválido.`);
  }
  return value;
}
function escapeIcs(value) {
  return value.replace(/\r\n?|\n/g, '\n').replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
// RFC 5545: each physical line is at most 75 UTF-8 octets, including the
// leading continuation space. Never split a multi-byte Unicode code point.
function fold(line) {
  let out = '', current = '', bytes = 0;
  for (const ch of line) {
    const width = encoder.encode(ch).length;
    if (bytes + width > 75) {
      out += current + '\r\n';
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += width;
  }
  return out + current;
}
function utcStamp(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError('Fecha de generación inválida.');
  }
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Export only follow-ups for sent quotes. By default client names are omitted
 * from the calendar for privacy. `namespace` must be a stable, opaque account
 * key (not an email), preventing UID collisions between users.
 */
export function buildFollowupCalendar(data, {namespace, includeClientNames = false,
  generatedAt = new Date()} = {}) {
  if (!NAMESPACE.test(namespace ?? '')) throw new TypeError('Identificador de calendario inválido.');
  if (typeof includeClientNames !== 'boolean') throw new TypeError('Opción de privacidad inválida.');
  if (!data || !Array.isArray(data.quotes) || data.quotes.length > 5000) {
    throw new TypeError('Cotizaciones inválidas.');
  }
  const stamp = utcStamp(generatedAt);
  const names = new Map();
  if (includeClientNames) {
    if (!Array.isArray(data.clients)) throw new TypeError('Clientes inválidos.');
    for (const client of data.clients) {
      if (!client || !ID.test(client.id ?? '') || names.has(client.id)) {
        throw new TypeError('Cliente inválido o duplicado.');
      }
      names.set(client.id, checkedText(client.name, 160, 'Nombre de cliente'));
    }
  }
  const seen = new Set(), events = [];
  for (const q of data.quotes) {
    if (!q || !ID.test(q.id ?? '') || seen.has(q.id) || !STATUSES.has(q.status)) {
      throw new TypeError('Cotización inválida o duplicada.');
    }
    seen.add(q.id);
    if (q.status !== 'enviada' || q.followUp == null || q.followUp === '') continue;
    if (!validDate(q.followUp)) throw new RangeError('Fecha de seguimiento inválida.');
    const number = checkedText(q.number, 80, 'Número de cotización');
    let summary = `Seguimiento ${number}`;
    if (includeClientNames) {
      if (!names.has(q.clientId)) throw new TypeError('Cliente de cotización no encontrado.');
      summary += ` — ${names.get(q.clientId)}`;
    }
    events.push({date:q.followUp, id:q.id, summary});
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//Sequeidau Labs//CotizaFlow Seguimientos v2//ES', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}.${namespace}@cotizaflow.invalid`,
      `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${nextDate(e.date)}`,
      `SUMMARY:${escapeIcs(e.summary)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
