export type Column = { key: string; label: string }

// Spreadsheets run a cell that starts with = @ or a sign followed by a non-digit as a formula.
// A leading apostrophe stops that. Phone numbers such as +234 are left alone.
const FORMULA_START = /^([=@\t\r]|[+-](?!\d))/

export function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function downloadCsv(fileName: string, columns: Column[], rows: Record<string, unknown>[]) {
  const header = columns.map((c) => cell(c.label)).join(',')
  const lines = rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))

  // The byte order mark tells Excel to read the file as UTF-8, so names with accents display correctly
  const content = `\uFEFF${[header, ...lines].join('\r\n')}\r\n`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// Dates shown in Lagos time, in a form people read easily
export function lagosDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Lagos',
  }).format(new Date(iso))
}

// Amounts are stored in kobo, so 150000 becomes 1500.00
export function naira(kobo: number): string {
  return (kobo / 100).toFixed(2)
}

// Turns a session or section name into a safe file name
export function fileSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'export'
}