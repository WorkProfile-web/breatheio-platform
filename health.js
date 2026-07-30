/**
 * GET /api/health
 * Simple health check. No API keys needed anymore.
 */
module.exports = async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    time: new Date().toISOString(),
    storage: 'in-memory',
    devices: require('./_store').getOnlineCount()
  }));
};
