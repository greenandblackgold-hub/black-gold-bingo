/** One JSON line per business event, so Render's log page doubles as an audit trail. Silent in tests. */
export function log(event, data = {}) {
  if (process.env.NODE_ENV === 'test') return;
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));
}
