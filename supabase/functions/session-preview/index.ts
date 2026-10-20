import { createClient } from 'jsr:@supabase/supabase-js@2'

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SessionPreview = {
  title: string
  description: string | null
  starts_at: string
  price_kobo: number
  status: 'draft' | 'published' | 'cancelled'
  sections: { name: string } | null
  guest_teachers: { name: string; photo_path: string | null } | null
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

function page(opts: { title: string; description: string; image: string; target: string }) {
  const t = esc(opts.title)
  const d = esc(opts.description)
  const i = esc(opts.image)
  const u = esc(opts.target)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta name="robots" content="index,follow" />
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
<script>location.replace(${JSON.stringify(opts.target)})</script>
</body>
</html>`
}

Deno.serve(async (req) => {
  const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const id = new URL(req.url).searchParams.get('id') ?? ''

  const generic = {
    title: 'Skillbloom',
    description: 'Live design and tech sessions, taught by working practitioners.',
    image: `${siteUrl}/share.png`,
  }

  // Unknown, malformed, draft, or cancelled sessions show the generic card and send people to the list
  if (!ID_PATTERN.test(id)) {
    return html(page({ ...generic, target: `${siteUrl}/sessions` }))
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data } = await admin
    .from('sessions')
    .select('title, description, starts_at, price_kobo, status, sections(name), guest_teachers(name, photo_path)')
    .eq('id', id)
    .maybeSingle()

  const s = data as unknown as SessionPreview | null

  if (!s || s.status !== 'published') {
    return html(page({ ...generic, target: `${siteUrl}/sessions` }))
  }

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
    ? `${supabaseUrl}/storage/v1/object/public/teacher-photos/${s.guest_teachers.photo_path}`
    : `${siteUrl}/share.png`

  return html(
    page({
      title: `${s.title} · ${s.sections?.name ?? 'Skillbloom'}`,
      description,
      image,
      target: `${siteUrl}/sessions/${id}`,
    }),
  )
})