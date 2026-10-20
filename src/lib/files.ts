import { supabase } from './supabase'

export type UploadedFile = { path: string; name: string; mime: string | null; size: number }

export const MAX_FILE_BYTES = 50 * 1024 * 1024

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Uploads files into a folder in a bucket. If one fails, the ones already uploaded are removed.
export async function uploadFiles(
  bucket: 'materials' | 'submissions',
  folder: string,
  files: File[],
): Promise<{ files: UploadedFile[]; error: string | null }> {
  const done: UploadedFile[] = []

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      if (done.length) await supabase.storage.from(bucket).remove(done.map((f) => f.path))
      return { files: [], error: `${file.name} is larger than 50 MB.` }
    }

    const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName(file.name)}`
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type || undefined })

    if (error) {
      if (done.length) await supabase.storage.from(bucket).remove(done.map((f) => f.path))
      return { files: [], error: `${file.name} could not be uploaded: ${error.message}` }
    }

    done.push({ path, name: file.name, mime: file.type || null, size: file.size })
  }

  return { files: done, error: null }
}

export async function openStoredFile(bucket: 'materials' | 'submissions', path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300)
  if (error || !data) throw new Error(error?.message ?? 'The file could not be opened.')
  window.open(data.signedUrl, '_blank', 'noopener')
}