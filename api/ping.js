/**
 * GET /api/ping
 * Simple endpoint for ESP32 to measure round-trip latency.
 * The ESP32 times how long the HTTP request takes and reports it back.
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200);
  res.end(JSON.stringify({ pong: true, time: Date.now() }));
};
