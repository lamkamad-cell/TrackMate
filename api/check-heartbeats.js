const webPush = require('web-push');
const { getSupabaseAdmin, sendJson } = require('./_lib/supabase');

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required');
  }

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@trackmate.local',
    publicKey,
    privateKey
  );
}

function isAuthorized(req) {
  if (!process.env.CRON_SECRET) return true;
  return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  try {
    configureWebPush();

    const supabase = getSupabaseAdmin();
    const timeoutSeconds = Number(process.env.HEARTBEAT_TIMEOUT_SECONDS || 60);
    const cooldownSeconds = Number(process.env.NOTIFICATION_COOLDOWN_SECONDS || 300);
    const expiredBefore = new Date(Date.now() - timeoutSeconds * 1000).toISOString();
    const notifyBefore = new Date(Date.now() - cooldownSeconds * 1000).toISOString();

    const { data: watches, error: watchesError } = await supabase
      .from('watches')
      .select('id, monitor_id, target_id, last_notified_at')
      .eq('active', true)
      .or(`last_notified_at.is.null,last_notified_at.lt.${notifyBefore}`);

    if (watchesError) throw watchesError;

    const targetIds = [...new Set((watches || []).map((watch) => watch.target_id))];
    const heartbeatByPeerId = new Map();

    if (targetIds.length > 0) {
      const { data: heartbeats, error: heartbeatsError } = await supabase
        .from('heartbeats')
        .select('peer_id, received_at')
        .in('peer_id', targetIds);

      if (heartbeatsError) throw heartbeatsError;

      for (const heartbeat of heartbeats || []) {
        heartbeatByPeerId.set(heartbeat.peer_id, heartbeat);
      }
    }

    const candidates = (watches || []).filter((watch) => {
      const receivedAt = heartbeatByPeerId.get(watch.target_id)?.received_at;
      return !receivedAt || receivedAt < expiredBefore;
    });

    let sent = 0;
    let failed = 0;

    for (const watch of candidates) {
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('monitor_id', watch.monitor_id)
        .eq('active', true);

      if (subscriptionsError) throw subscriptionsError;

      for (const item of subscriptions || []) {
        try {
          await webPush.sendNotification(
            item.subscription,
            JSON.stringify({
              title: 'TrackMate Heartbeat Lost',
              body: `User B (${watch.target_id}) tidak mengirim heartbeat. Periksa perangkat User B.`,
              tag: `trackmate-heartbeat-${watch.target_id}`,
              url: './trackmate.html',
              targetId: watch.target_id
            })
          );
          sent += 1;
        } catch (err) {
          failed += 1;
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .update({ active: false })
              .eq('id', item.id);
          }
        }
      }

      await supabase
        .from('watches')
        .update({ last_notified_at: new Date().toISOString() })
        .eq('id', watch.id);

      await supabase
        .from('notification_events')
        .insert({
          monitor_id: watch.monitor_id,
          target_id: watch.target_id,
          event_type: 'heartbeat_lost',
          payload: {
            timeoutSeconds,
            expiredBefore
          }
        });
    }

    sendJson(res, 200, {
      ok: true,
      checked: watches?.length || 0,
      expired: candidates.length,
      sent,
      failed
    });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
};
