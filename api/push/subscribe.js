const {
  cleanId,
  getSupabaseAdmin,
  methodNotAllowed,
  sendJson
} = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  try {
    const monitorId = cleanId(req.body?.monitorId);
    const targetId = req.body?.targetId ? cleanId(req.body.targetId) : null;
    const subscription = req.body?.subscription;

    if (!monitorId || !subscription?.endpoint) {
      sendJson(res, 400, { error: 'monitorId and subscription.endpoint are required' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          monitor_id: monitorId,
          endpoint: subscription.endpoint,
          subscription,
          user_agent: req.headers['user-agent'] || null,
          active: true
        },
        { onConflict: 'endpoint' }
      );

    if (subscriptionError) throw subscriptionError;

    if (targetId) {
      const { error: watchError } = await supabase
        .from('watches')
        .upsert(
          {
            monitor_id: monitorId,
            target_id: targetId,
            active: true
          },
          { onConflict: 'monitor_id,target_id' }
        );

      if (watchError) throw watchError;
    }

    sendJson(res, 200, { ok: true, watching: Boolean(targetId) });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
};
