const {
  cleanId,
  finiteNumberOrNull,
  getSupabaseAdmin,
  methodNotAllowed,
  sendJson
} = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    methodNotAllowed(res);
    return;
  }

  try {
    const peerId = cleanId(req.body?.peerId);
    if (!peerId) {
      sendJson(res, 400, { error: 'peerId is required' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const receivedAt = new Date().toISOString();
    const { error } = await supabase
      .from('heartbeats')
      .upsert(
        {
          peer_id: peerId,
          connected_to: req.body?.connectedTo ? cleanId(req.body.connectedTo) : null,
          location_shared: Boolean(req.body?.locationShared),
          lat: finiteNumberOrNull(req.body?.lat),
          lng: finiteNumberOrNull(req.body?.lng),
          received_at: receivedAt
        },
        { onConflict: 'peer_id' }
      );

    if (error) throw error;

    sendJson(res, 200, { ok: true, receivedAt });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
};
