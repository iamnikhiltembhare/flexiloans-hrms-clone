// HR Assistant: natural language over the HRMS tools in src/lib/assistant.
//
// With ANTHROPIC_API_KEY set, Claude reads the request and calls the tools;
// without it, the built-in rules engine answers. Either way:
//   - tools only see the signed-in person's permitted view of the data,
//   - write tools return proposals that the person must confirm in the app
//     (the assistant itself never changes anything),
//   - salary, termination, promotion, disciplinary and sensitive personal
//     data requests are refused before any model or tool runs.

import Anthropic from '@anthropic-ai/sdk'
import { runTool, toolSchemas, sensitiveTopic, SENSITIVE_REPLY } from '../src/lib/assistant/tools.js'
import { answerWithRules } from '../src/lib/assistant/rules.js'

const MODEL = 'claude-opus-5'
const MAX_STEPS = 6

// Stable across requests so it stays in the prompt cache; everything about
// the person and the date goes in the second, uncached block.
const SYSTEM = `You are the HR Assistant inside a company HRMS. You help HR staff, admins and employees with routine HR work: finding employees, attendance, leave, helpdesk tickets, recruitment, onboarding and HR reports.

Rules:
- Use the tools for every fact about employees, attendance, leave, tickets or hiring. Never invent names, numbers or dates. If a tool returns an error, tell the user plainly what they can do instead.
- You cannot change anything yourself. To approve, reject, apply for leave, move a candidate or update a ticket, call the matching propose_* tool. It prepares the change and the app shows the user a Confirm button. Say that it is ready for them to confirm; never say it is done.
- Only offer actions the user's role allows. The tools enforce this; do not try to work around a refusal.
- Never handle salary or compensation changes, terminations, promotions or demotions, disciplinary decisions, or sensitive personal data (bank, PAN, Aadhaar, health). Say these need explicit authorisation and a person to review them, and point to the HR process.
- The app shows tool results as tables and cards under your message, so do not repeat whole tables. Give a short answer: the headline numbers or names, then offer a sensible next step.
- Be brief and plain. Use short lists only when listing a few items. Dates as they appear in the data (YYYY-MM-DD) are fine.`

function contextBlock(ctx) {
  const a = ctx.actor
  return 'Signed-in user: ' + a.name + ' (' + a.id + '), role ' + a.role + ', ' + (a.designation || '') + ', ' + (a.department || '') + '. Permissions: ' + a.perms.join(', ') + '. Today is ' + ctx.today + '.'
}

/** Turn saved chat turns into a valid alternating message list. */
function toMessages(history, message) {
  const out = []
  for (const h of (history || []).slice(-12)) {
    const role = h.role === 'assistant' ? 'assistant' : 'user'
    const text = String(h.text || '').slice(0, 2000)
    if (!text) continue
    if (!out.length && role === 'assistant') continue
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n' + text
    else out.push({ role, content: text })
  }
  if (out.length && out[out.length - 1].role === 'user') out[out.length - 1].content += '\n' + message
  else out.push({ role: 'user', content: message })
  return out
}

/** `client` can be injected for tests; otherwise built from the API key. */
export function createAssistant({ apiKey, client } = {}) {
  const anthropic = client || (apiKey ? new Anthropic({ apiKey }) : null)

  async function withClaude(message, history, ctx) {
    const messages = toMessages(history, message)
    const tools = toolSchemas()
    const cards = []
    const proposals = []
    const used = []
    let reply = ''

    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: contextBlock(ctx) },
        ],
        tools,
        messages,
      })

      if (response.stop_reason === 'refusal') {
        return { reply: 'I cannot help with that request.', cards, proposals, tools: used, refused: true }
      }
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
      if (text) reply = text
      const calls = response.content.filter((b) => b.type === 'tool_use')
      if (response.stop_reason !== 'tool_use' || !calls.length) break

      messages.push({ role: 'assistant', content: response.content })
      const results = calls.map((call) => {
        used.push(call.name)
        const input = call.input && typeof call.input === 'object' ? call.input : {}
        const out = runTool(call.name, input, ctx)
        if (out.card) cards.push(out.card)
        if (out.proposal) proposals.push(out.proposal)
        return {
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(out.error ? { error: out.error } : out.data),
          ...(out.error ? { is_error: true } : {}),
        }
      })
      // All results for one turn go back in a single user message.
      messages.push({ role: 'user', content: results })
    }
    return { reply: reply || 'Here is what I found.', cards, proposals, tools: used }
  }

  return {
    engine: anthropic ? 'claude' : 'rules',
    async answer({ message, history, ctx, memory }) {
      const sensitive = sensitiveTopic(message)
      if (sensitive) return { reply: SENSITIVE_REPLY(sensitive), cards: [], proposals: [], refused: true, engine: 'policy' }
      if (!anthropic) return { ...answerWithRules(message, ctx, memory), engine: 'rules' }
      try {
        return { ...(await withClaude(message, history, ctx)), engine: 'claude' }
      } catch (err) {
        // Model unavailable (network, rate limit, bad key): keep helping with
        // the built-in engine rather than failing the chat.
        if (err instanceof Anthropic.APIError) console.error('Assistant model error', err.status, err.message)
        else console.error('Assistant error', err)
        return { ...answerWithRules(message, ctx, memory), engine: 'rules', degraded: true }
      }
    },
  }
}
