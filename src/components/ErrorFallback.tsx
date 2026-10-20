export default function ErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-background px-5">
      <div className="card max-w-md p-10 text-center">
        <img src="/logo.svg" alt="" className="mx-auto h-12 w-12" />
        <p className="eyebrow mt-6">Something went wrong</p>
        <h1 className="mt-3 text-3xl">We've been notified</h1>
        <p className="mt-4 leading-relaxed text-brand-muted">
          The error has been reported to the Skillbloom team. Reload the page to continue. If it keeps
          happening, contact us and tell us what you were doing.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={() => window.location.reload()} className="btn-primary">
            Reload page
          </button>
          <a href="/" className="btn-ghost">
            Go to home
          </a>
        </div>
      </div>
    </div>
  )
}