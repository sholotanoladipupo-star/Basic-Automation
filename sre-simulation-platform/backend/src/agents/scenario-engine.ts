import Anthropic from '@anthropic-ai/sdk'
import { SystemState, SessionEvent } from '../types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runScenarioEngine(
  systemState: SystemState,
  recentEvents: SessionEvent[],
  topologyDescription: string
): Promise<Partial<SystemState> | null> {
  const recentSummary = recentEvents
    .slice(-10)
    .map(e => `[${e.sim_ts}] ${e.type}: ${JSON.stringify(e.payload).slice(0, 120)}`)
    .join('\n')

  const stateCompact = {
    sim_time: systemState.sim_time,
    services: Object.fromEntries(
      Object.entries(systemState.services).map(([k, v]) => [
        k, { status: v.status, error_rate: v.error_rate }
      ])
    ),
    caches: systemState.infrastructure.caches.map(c => ({ name: c.name, status: c.status, hit_rate: c.hit_rate })),
    databases: systemState.infrastructure.databases.map(d => ({
      name: d.name, status: d.status, connection_count: d.connection_count, query_latency_ms: d.query_latency_ms
    })),
    active_incidents: systemState.active_incidents.length
  }

  const systemPrompt = `You are an SRE scenario engine. You manage incident evolution for a simulation.
Decide whether to evolve the incident: make it worse, better, or hold steady.

Topology: ${topologyDescription}

Current state:
${JSON.stringify(stateCompact, null, 2)}

Engineer actions in last few turns:
${recentSummary || '(none)'}

Rules:
- If engineer is actively investigating the right service (redis), hold steady
- If engineer is ignoring the incident entirely for 5+ minutes, slightly worsen
- If engineer ran a redis restart command, begin gradual recovery in next turns
- Changes must be small and realistic — no sudden jumps
- Most of the time (70%), return null (hold steady)

Respond ONLY with null OR a valid JSON patch of SystemState fields to update.
Example patch: {"services": {"order-service": {"error_rate": 0.55, "p99_latency_ms": 9200}}}
No markdown. No explanation. Just null or JSON.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: 'Decide whether and how to evolve the incident.' }],
      system: systemPrompt
    })

    const content = response.content[0]
    if (content.type !== 'text') return null

    const text = content.text.trim()
    if (text === 'null' || text === '') return null

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0]) as Partial<SystemState>
  } catch {
    return null
  }
}
