const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const layout = (body: string) => `
<div style="font-family: Inter, Arial, sans-serif; background:#FAF8F4; padding:32px; color:#1F2430;">
  <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border:1px solid #E4E7EC; padding:32px; line-height:1.6;">
    <p style="font-family: Georgia, serif; font-size:20px; color:#1B2A4A; margin:0 0 24px;">Skillbloom</p>
    ${body}
  </div>
</div>`

const li = (items: string[]) =>
  `<ul style="padding-left:20px; margin:8px 0 16px;">${items.map((i) => `<li style="margin-bottom:6px;">${i}</li>`).join('')}</ul>`

// Teacher invitation: approved wording
export function teacherInviteEmail(p: {
  name: string
  sessionTitle: string
  section: string
  firstSession: string
  accessEnds: string
  siteUrl: string
  inviteUrl: string
}) {
  const subject = `You're now teaching on Skillbloom, ${p.sessionTitle}`
  const html = layout(`
    <p>Hello ${esc(p.name)},</p>
    <p>You've been invited to teach <strong>${esc(p.sessionTitle)}</strong>, in the ${esc(p.section)} section. The session runs on <strong>${esc(p.firstSession)}</strong>, and students will have access until <strong>${esc(p.accessEnds)}</strong>.</p>

    <p style="margin-top:24px;"><strong>Your share</strong></p>
    <p>You'll receive 20% of the amount collected for your session, after Paystack's processing fee has been deducted. Payment is made after the session ends, once the Skillbloom admin sends the payout. It goes directly to the bank account you give us, and you'll get an email when it has been sent.</p>
    <p>To receive it, please reply to this email with your full name as it appears on your bank account, your bank name, and your account number. We'll check it before any payment is made.</p>

    <p style="margin-top:24px;"><strong>What you can do on your teaching page</strong></p>
        <p style="margin-top:24px;"><strong>Set your password</strong></p>
    <p>Use this link to set your password and log in. The link works once, so please don't share it: <a href="${esc(p.inviteUrl)}" style="color:#1B2A4A;">set up your account</a></p>
    <p>Log in at <a href="${esc(p.siteUrl)}" style="color:#1B2A4A;">${esc(p.siteUrl.replace('https://', ''))}</a> and open <strong>Teaching</strong>. From there you can:</p>
    ${li([
      'Add your Zoom or Google Meet link, plus a backup link, so students can join.',
      'Upload classwork, assignments and tests, in any file format.',
      'Create multiple-choice, short answer, long answer and file-upload questions.',
      'Mark student work and leave feedback.',
      'Publish recordings when they are ready.',
      'Record attendance and download student results as spreadsheets.',
      'Message your class, and receive private messages from students.',
    ])}
    <p>Students can see your session only after it is published, so please check the details with the admin before the session date.</p>
    <p>If anything looks wrong, reply to this email and we'll sort it out.</p>
    <p>Thank you for teaching with us.</p>
    <p style="margin-top:24px;">The Skillbloom team<br/>skillbloom774@gmail.com</p>
  `)
  return { subject, html }
}

// Student receipt: approved wording
export function receiptEmailV2(p: {
  name: string
  sessionTitle: string
  section: string
  teacher: string
  firstSession: string
  amountNaira: string
  accessEnds: string
  cardUrl: string
  siteUrl: string
}) {
  const subject = `Payment confirmed: ${p.sessionTitle}`
  const html = layout(`
    <p>Hello ${esc(p.name)},</p>
    <p>Thank you. Your payment of <strong>${esc(p.amountNaira)}</strong> for <strong>${esc(p.sessionTitle)}</strong> has been confirmed, and your place is secured.</p>

    <p style="margin-top:24px;"><strong>What you've bought</strong></p>
    ${li([
      `<strong>Session:</strong> ${esc(p.sessionTitle)}, in the ${esc(p.section)} section`,
      `<strong>Taught by:</strong> ${esc(p.teacher)}`,
      `<strong>First session:</strong> ${esc(p.firstSession)} (Lagos time)`,
      '<strong>Join the session:</strong> from your session room, from 15 minutes before the start. The meeting link appears there, not in this email.',
      `<strong>Your access runs until:</strong> ${esc(p.accessEnds)}. Your materials and recordings stay available until then.`,
    ])}

    <p style="margin-top:24px;"><strong>Your access card</strong></p>
    <p>Show your access card, or share its verification link with anyone who needs to check your place: <a href="${esc(p.cardUrl)}" style="color:#1B2A4A;">${esc(p.cardUrl)}</a></p>

    <p style="margin-top:24px;"><strong>What happens next</strong></p>
    ${li([
      'You\'ll get a reminder 24 hours before the session, and another 15 minutes before it starts.',
      'To add the sessions to your calendar, open <strong>Calendar feed</strong> on your account page.',
      'Questions about the session can go in the class chat after you join. For anything else, reply to this email.',
    ])}

    <p style="margin-top:24px;"><strong>Refunds</strong></p>
    <p>You can request a refund any time before the session starts, from your dashboard. Our full Refund Policy is at <a href="${esc(p.siteUrl)}/refunds" style="color:#1B2A4A;">${esc(p.siteUrl.replace('https://', ''))}/refunds</a>.</p>

    <p>Thank you for learning with us.</p>
    <p style="margin-top:24px;">The Skillbloom team<br/>skillbloom774@gmail.com</p>
  `)
  return { subject, html }
}