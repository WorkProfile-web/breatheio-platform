/**
 * GET /api/health
 * Simple health check to verify the Vercel Serverless Functions are working.
 */
module.exports = async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    time: new Date().toISOString(),
    env: {
      hasToken: !!process.env.GITHUB_TOKEN,
      repo: process.env.GITHUB_REPO || '(not set)'
    }
  }));
};
