// Netlify Function entry point: serves every /api/* route from app.js,
// with data kept in Netlify Blobs.

import { createApp } from '../app.js'
import { blobsStore } from '../store-blobs.js'

let handle

export default async (req) => {
  const secret = process.env.HRMS_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    // Fail loudly and harmlessly rather than signing tokens with a weak key.
    return Response.json(
      { error: 'Server not configured: set HRMS_TOKEN_SECRET (32+ random characters) on this Netlify site, then redeploy.' },
      { status: 503 })
  }
  handle ??= createApp({
    store: blobsStore(),
    secret,
    allowedOrigins: process.env.HRMS_ALLOWED_ORIGINS
      ? process.env.HRMS_ALLOWED_ORIGINS.split(',').map((s) => s.trim())
      : undefined,
  })
  return handle(req)
}

export const config = { path: '/api/*' }
