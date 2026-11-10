import { Link } from 'react-router-dom'

const SCHEDULE = ['February', 'April', 'June', 'August', 'October', 'December']

const FOUNDER_PARAGRAPHS = [
  'Lydia Abidoh is a creative entrepreneur, graphic designer, technology enthusiast, and the Founder and Chief Executive Officer of Skillbloom, a technology education platform established with a vision to make digital skills education more accessible, practical, and impactful.',
  'Driven by a passion for creativity, innovation, and personal development, Lydia believes that technology and digital skills are powerful tools for transforming lives, creating opportunities, and building a better future.',
  'With a background in graphic design and desktop publishing, alongside knowledge of Python programming and a growing interest in technology, she brings together creativity and technology in her approach to leadership and innovation.',
  'Beyond her creative pursuits, Lydia is passionate about empowerment, entrepreneurship, and helping individuals and businesses grow through knowledge, resource management, and strategic awareness.',
  'Through Skillbloom, she is committed to creating opportunities for individuals to acquire practical technology skills, discover their potential, and become equipped for an increasingly digital world.',
  'Her vision is to build Skillbloom into a platform that inspires learning, nurtures creativity, develops digital competence, and empowers people to turn their knowledge into meaningful opportunities.',
  'She believes that everyone has the potential to become remarkable when given access to the right knowledge, guidance, and opportunities.',
]

export default function Home() {
  return (
    <>
      <section className="container-page py-16 sm:py-24">
        <p className="eyebrow">Live sessions, every two months</p>
        <h1 className="mt-5 max-w-3xl text-5xl leading-[1.1] sm:text-6xl">
          Learn design and tech from a working expert.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-brand-muted">
          Each session is taught live by a guest practitioner on Zoom or Google Meet. Pay for one session, and get
          classwork, tests, a class chat and a certificate when you complete the work.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/sessions" className="btn-primary">Browse sessions</Link>
          <Link to="/login" className="btn-ghost">Create an account</Link>
        </div>
      </section>

      <section className="border-y border-brand-border bg-brand-surface">
        <div className="container-page py-12">
          <p className="eyebrow">Session months</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {SCHEDULE.map((m) => (
              <span key={m} className="pill px-4 py-2 text-sm">{m}</span>
            ))}
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-brand-muted">
            Sessions run every two months. Each one gives you access for its full month, so there is always time to
            complete the work.
          </p>
        </div>
      </section>

      <section className="container-page py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[360px_1fr] lg:gap-16">
          <div>
            <img
              src="/founder.jpg"
              alt="Lydia Abidoh, Founder and Chief Executive Officer of Skillbloom"
              className="aspect-[3/4] w-full rounded-2xl object-cover"
            />
          </div>

          <div>
            <p className="eyebrow">About the founder</p>
            <h2 className="mt-4 text-4xl">Lydia Abidoh</h2>
            <p className="mt-3 text-lg text-brand-primary">
              Founder &amp; Chief Executive Officer of Skillbloom
            </p>

            <div className="mt-8 grid gap-5 text-base leading-relaxed text-brand-text">
              {FOUNDER_PARAGRAPHS.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-brand-border bg-brand-primary">
        <div className="container-page flex flex-col gap-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl text-white">Ready to start learning?</h2>
            <p className="mt-3 max-w-xl text-white/75">
              Browse the upcoming sessions, or create an account to get started.
            </p>
          </div>
          <Link to="/sessions" className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-[15px] font-medium text-brand-primary transition hover:bg-white/90">
            View sessions
          </Link>
        </div>
      </section>
    </>
  )
}