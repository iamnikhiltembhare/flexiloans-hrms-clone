// Netlify Blobs storage for the serverless deploy. update() is a
// compare-and-swap on the blob's ETag, retried when another request wins.

import { getStore } from '@netlify/blobs'

const RETRIES = 8

export function blobsStore(name = 'hrms') {
  const store = getStore({ name, consistency: 'strong' })

  return {
    async get(key) {
      return (await store.get(key, { type: 'json' })) ?? undefined
    },
    async set(key, value) {
      await store.setJSON(key, value)
    },
    async update(key, fn) {
      for (let attempt = 0; attempt < RETRIES; attempt++) {
        const found = await store.getWithMetadata(key, { type: 'json' })
        const next = fn(found ? found.data : undefined)
        const { modified } = await store.setJSON(key, next, found ? { onlyIfMatch: found.etag } : { onlyIfNew: true })
        if (modified) return next
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)))
      }
      throw new Error('Could not save ' + key + ' - too many concurrent writes')
    },
  }
}
