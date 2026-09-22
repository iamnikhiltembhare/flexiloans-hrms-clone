// Best-effort client-side file download. Sandboxed hosts may block it, so the
// caller should always show a toast regardless of what this returns.
export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  try {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return true
  } catch {
    return false
  }
}

export function toCSV(columns, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const head = columns.map((c) => esc(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => esc(c.value ? c.value(r) : r[c.key])).join(',')).join('\n')
  return head + '\n' + body
}

export function downloadCSV(filename, columns, rows) {
  return downloadFile(filename, toCSV(columns, rows), 'text/csv;charset=utf-8')
}
