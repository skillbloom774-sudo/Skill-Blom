const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SITE = 'https://skill-blom.vercel.app'
const DEFAULT_IMAGE = `${SITE}/share.png`

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function page({ title, description, image, target }) {
  const t = esc(title)
  const d = esc(description)
  const i = esc(image)
  const u = esc(target)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Skillbloom" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${u}" />
<meta property="og:image" content="${i}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${i}" />
<meta http-equiv="refresh" content="0; url=${u}" />
</head>
<body>
<p>Taking you to <a href="${u}">the session</a>.</p>
<script>location.replace(${JSON.stringify(target)})</script>
</body>
</html>`
}

export default async function handler(req, res) {
  const id = String(req.query.id ?? '')
  const generic = {
    title: 'Skillbloom',
    description: 'Live design and tech sessions, taught by working practitioners.',
    image: DEFAULT_IMAGE,
    target: `${SITE}/sessions`,
  }

  const send = (body) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.status(200).send(body)
  }

  if (!ID.test(id)) return send(page(generic))

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  const query =
    `${url}/rest/v1/sessions?id=eq.${id}` +
    `&select=title,description,starts_at,price_kobo,status,sections(name),guest_teachers(name,photo_path)`

  const r = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  const rows = r.ok ? await r.json() : []
  const s = rows[0]

  // Unknown, draft, or cancelled sessions show the generic card and go to the list
  if (!s || s.status !== 'published') return send(page(generic))

  const when = new Intl.DateTimeFormat('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(new Date(s.starts_at))
  const price = `₦${(s.price_kobo / 100).toLocaleString('en-NG')}`
  const teacher = s.guest_teachers?.name
  const summary = s.description?.trim()

  const description = summary
    ? summary.slice(0, 160)
    : `Live session${teacher ? ` with ${teacher}` : ''}. ${when}. ${price} for this month.`

  const image = s.guest_teachers?.photo_path
    ? `${url}/storage/v1/object/public/teacher-photos/${s.guest_teachers.photo_path}`
    : DEFAULT_IMAGE

  send(
    page({
      title: `${s.title} · ${s.sections?.name ?? 'Skillbloom'}`,
      description,
      image,
      target: `${SITE}/sessions/${id}`,
    }),
  )
}