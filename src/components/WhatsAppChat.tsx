import { useEffect, useRef, useState } from 'react'
import { WHATSAPP_CONTACTS, WHATSAPP_MESSAGE } from '../lib/site'

function waLink(number: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
}

function WhatsAppIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="currentColor">
      <path d="M16.04 3C9.4 3 4 8.36 4 14.96c0 2.11.56 4.17 1.62 5.98L4 29l8.2-2.15a12.1 12.1 0 0 0 3.84.62h.01c6.63 0 12.03-5.36 12.03-11.96C28.08 8.36 22.67 3 16.04 3zm0 21.9h-.01a10 10 0 0 1-5.1-1.4l-.37-.22-4.87 1.28 1.3-4.73-.24-.39a9.9 9.9 0 0 1-1.52-5.5c0-5.5 4.5-9.97 10-9.97 2.66 0 5.17 1.03 7.05 2.9a9.85 9.85 0 0 1 2.92 7.06c0 5.5-4.49 9.97-10 9.97zm5.48-7.47c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.17.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.25-.25-.6-.5-.51-.68-.52h-.58c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.14 4.54.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.79-.73 2.04-1.44.25-.7.25-1.3.18-1.44-.08-.13-.28-.2-.58-.35z" />
    </svg>
  )
}

export default function WhatsAppChat() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close the menu when the person clicks anywhere else
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div ref={ref} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="w-64 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-lg">
          <p className="border-b border-brand-border px-4 py-3 text-sm font-medium text-brand-text">
            Chat on WhatsApp
          </p>
          {WHATSAPP_CONTACTS.map((c) => (
            <a
              key={c.label}
              href={waLink(c.number)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 transition hover:bg-brand-primary-soft"
            >
              <span className="block text-sm font-medium text-brand-text">{c.label}</span>
              <span className="block text-xs text-brand-muted">{c.display}</span>
            </a>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat on WhatsApp"
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
      >
        <WhatsAppIcon />
      </button>
    </div>
  )
}