/**
 * functions/api/[[route]].ts
 * Cloudflare Pages Function — catches all /api/* requests.
 * Exposes D1 data over a simple REST interface for the PWA to sync with.
 *
 * Bindings required in wrangler.toml (or Pages dashboard):
 *   [[d1_databases]]
 *   binding = "DB"
 *   database_name = "timeireland"
 *   database_id   = "<your-d1-database-id>"
 */

import type { D1Database } from '../../src/db/schema'

interface Env {
  DB: D1Database
}

type RouteHandler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status)
}

// ─── Route table ──────────────────────────────────────────────────────────────

const ROUTES: Record<string, Record<string, RouteHandler>> = {
  '/api/sessions': {
    GET: async (_req, env) => {
      const result = await env.DB
        .prepare('SELECT * FROM sessions ORDER BY start_time DESC LIMIT 200')
        .all()
      return json(result.results)
    },
    POST: async (req, env) => {
      const body = await req.json<{
        id: string
        start_time: string
        end_time?: string
        shift_type: string
        note: string
        project_id?: string
      }>()
      await env.DB
        .prepare(
          `INSERT INTO sessions (id, start_time, end_time, shift_type, note, project_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             end_time = excluded.end_time,
             shift_type = excluded.shift_type,
             note = excluded.note,
             project_id = excluded.project_id`
        )
        .bind(
          body.id,
          body.start_time,
          body.end_time ?? null,
          body.shift_type,
          body.note,
          body.project_id ?? null,
          new Date().toISOString()
        )
        .run()
      return json({ ok: true }, 201)
    },
  },

  '/api/projects': {
    GET: async (_req, env) => {
      const result = await env.DB
        .prepare('SELECT * FROM projects WHERE is_archived = 0 ORDER BY name')
        .all()
      return json(result.results)
    },
  },

  '/api/hourly-rates': {
    GET: async (_req, env) => {
      const result = await env.DB
        .prepare('SELECT * FROM hourly_rates ORDER BY priority, sort_order')
        .all()
      // Parse days_of_week JSON string → array for the client
      const rows = (result.results as Record<string, unknown>[]).map((r) => ({
        ...r,
        days_of_week: JSON.parse((r.days_of_week as string) || '[]'),
      }))
      return json(rows)
    },
    POST: async (req, env) => {
      const body = await req.json<{
        id: string
        title: string
        rate: number
        condition_text: string
        computes_per_day: boolean
        days_of_week: number[]
        priority: number
        max_hours: number | null
        sort_order: number
      }>()
      await env.DB
        .prepare(
          `INSERT INTO hourly_rates
             (id, title, rate, condition_text, computes_per_day,
              days_of_week, priority, max_hours, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title            = excluded.title,
             rate             = excluded.rate,
             condition_text   = excluded.condition_text,
             computes_per_day = excluded.computes_per_day,
             days_of_week     = excluded.days_of_week,
             priority         = excluded.priority,
             max_hours        = excluded.max_hours,
             sort_order       = excluded.sort_order`
        )
        .bind(
          body.id,
          body.title,
          body.rate,
          body.condition_text,
          body.computes_per_day ? 1 : 0,
          JSON.stringify(body.days_of_week ?? []),
          body.priority ?? 1,
          body.max_hours ?? null,
          body.sort_order ?? 0,
        )
        .run()
      return json({ ok: true }, 201)
    },
    DELETE: async (req, env) => {
      const { searchParams } = new URL(req.url)
      const id = searchParams.get('id')
      if (!id) return err('Missing id')
      await env.DB.prepare('DELETE FROM hourly_rates WHERE id = ?').bind(id).run()
      return json({ ok: true })
    },
  },

  '/api/public-holidays': {
    GET: async (_req, env) => {
      const result = await env.DB
        .prepare('SELECT * FROM public_holidays ORDER BY date')
        .all()
      return json(result.results)
    },
    POST: async (req, env) => {
      const body = await req.json<{ id: string; name: string; date: string }>()
      await env.DB
        .prepare(
          `INSERT INTO public_holidays (id, name, date)
           VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             date = excluded.date`
        )
        .bind(body.id, body.name, body.date)
        .run()
      return json({ ok: true }, 201)
    },
    DELETE: async (req, env) => {
      const { searchParams } = new URL(req.url)
      const id = searchParams.get('id')
      if (!id) return err('Missing id')
      await env.DB.prepare('DELETE FROM public_holidays WHERE id = ?').bind(id).run()
      return json({ ok: true })
    },
  },

  '/api/settings': {
    GET: async (_req, env) => {
      const row = await env.DB
        .prepare('SELECT * FROM payroll_settings WHERE id = 1')
        .first()
      return json(row ?? {})
    },
    PUT: async (req, env) => {
      const body = await req.json<Record<string, unknown>>()
      await env.DB
        .prepare(
          `INSERT INTO payroll_settings
             (id, hourly_rate, employment_type, tax_band, personal_tax_credit, prsi_class, usc_exempt)
           VALUES (1, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             hourly_rate         = excluded.hourly_rate,
             employment_type     = excluded.employment_type,
             tax_band            = excluded.tax_band,
             personal_tax_credit = excluded.personal_tax_credit,
             prsi_class          = excluded.prsi_class,
             usc_exempt          = excluded.usc_exempt`
        )
        .bind(
          body.hourly_rate,
          body.employment_type,
          body.tax_band,
          body.personal_tax_credit,
          body.prsi_class,
          body.usc_exempt ? 1 : 0
        )
        .run()
      return json({ ok: true })
    },
  },
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const route  = ROUTES[url.pathname]
  if (!route) return err('Not found', 404)

  const handler = route[request.method]
  if (!handler) return err('Method not allowed', 405)

  try {
    return await handler(request, env, context.waitUntil.bind(context))
  } catch (e) {
    console.error(e)
    return err('Internal server error', 500)
  }
}
