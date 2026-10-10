import { supabase } from '../../lib/supabase.js';
import { createWeeklyPlan } from '../../lib/weeklyPlanner.js';
import { getTodayInTimezone } from '../../lib/dateUtils.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const weekStart = getTodayInTimezone();

  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true);

  if (error) return res.status(500).json({ error });

  const results = [];

  for (const client of clients) {
    try {
      const inserted = await createWeeklyPlan({ client, weekStart });
      results.push({ clientId: client.id, ok: true, count: inserted.length });
    } catch (err) {
      console.error(`[${client.id}] Errore weekly plan:`, err.message);
      results.push({ clientId: client.id, ok: false, error: err.message });
    }
  }

  return res.status(200).json({ ok: true, results });
}