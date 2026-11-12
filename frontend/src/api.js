export async function api(path, options = {}) {
  let response
  try { response = await fetch('/api' + path, options) }
  catch { throw new Error('The local API is unavailable. Start the FastAPI server on 127.0.0.1:8000.') }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'The request failed. Check the selected file or filters.')
  return data
}
export const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
