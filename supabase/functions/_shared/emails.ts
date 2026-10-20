const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function wrap(content: string) {
  return `
<div style="font-family: Inter, Arial, sans-serif; background:#FAF8F4; padding:32px; color:#1F2430;">
  <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border:1px solid #E4E7EC; padding:32px;">
    <p style="font-family: Georgia, serif; font-size:20px; color:#1B2A4A; margin:0 0 24px;">Skillbloom</p>
    ${content}
    <p style="font-size:12px; color:#667085; margin-top:32px;">You're receiving this because you have a Skillbloom account.</p>
  </div>
</div>`
}

export function receiptEmail(opts: {
  name: string
  sessionTitle: string
  amountNaira: string
  cardId: string
  accessEnds: string
  cardUrl: string
}) {
  return {
    subject: `Your access to ${opts.sessionTitle}`,
    html: wrap(`
      <h1 style="font-family: Georgia, serif; font-size:24px; color:#1B2A4A; margin:0 0 16px;">Payment received</h1>
      <p>Hi ${escapeHtml(opts.name)}, thank you. You now have access to <strong>${escapeHtml(opts.sessionTitle)}</strong>.</p>
      <table style="width:100%; border-collapse:collapse; margin:24px 0; font-size:14px;">
        <tr><td style="padding:8px 0; color:#667085;">Amount paid</td><td style="padding:8px 0; text-align:right;">${opts.amountNaira}</td></tr>
        <tr><td style="padding:8px 0; color:#667085;">Access until</td><td style="padding:8px 0; text-align:right;">${opts.accessEnds}</td></tr>
        <tr><td style="padding:8px 0; color:#667085;">Card ID</td><td style="padding:8px 0; text-align:right; font-family:monospace;">${opts.cardId}</td></tr>
      </table>
      <a href="${opts.cardUrl}" style="display:inline-block; background:#1B2A4A; color:#FFFFFF; padding:12px 20px; text-decoration:none; border-radius:6px;">View your access card</a>
    `),
  }
}

export function reminderEmail(opts: {
  name: string
  sessionTitle: string
  when: string
  kind: '24h' | '15m'
  roomUrl: string
}) {
  const is24h = opts.kind === '24h'
  const subject = is24h
    ? `In 24 hours: ${opts.sessionTitle}`
    : `Starting soon: ${opts.sessionTitle}`
  const headline = is24h ? 'Your session is in 24 hours' : 'Your session starts in 15 minutes'
  const intro = is24h
    ? 'A heads-up so the time is in your diary. Your session room has your classwork and materials.'
    : 'Open your session room now. The join button appears there as soon as the session is ready.'

  return {
    subject,
    html: wrap(`
      <h1 style="font-family: Georgia, serif; font-size:24px; color:#1B2A4A; margin:0 0 16px;">${headline}</h1>
      <p>Hi ${escapeHtml(opts.name)}, ${intro}</p>
      <table style="width:100%; border-collapse:collapse; margin:24px 0; font-size:14px;">
        <tr><td style="padding:8px 0; color:#667085;">Session</td><td style="padding:8px 0; text-align:right;">${escapeHtml(opts.sessionTitle)}</td></tr>
        <tr><td style="padding:8px 0; color:#667085;">Starts</td><td style="padding:8px 0; text-align:right;">${escapeHtml(opts.when)}</td></tr>
      </table>
      <a href="${opts.roomUrl}" style="display:inline-block; background:#1B2A4A; color:#FFFFFF; padding:12px 20px; text-decoration:none; border-radius:6px;">Open session room</a>
    `),
  }
}