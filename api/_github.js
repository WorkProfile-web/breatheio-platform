/**
 * GitHub API utility for storing device data.
 * Reads/writes devices.json in a GitHub repo as a simple database.
 *
 * Required environment variables:
 *   GITHUB_TOKEN  - Personal Access Token with repo scope
 *   GITHUB_REPO   - "owner/repo-name" (e.g. "yourname/breatheio-devices")
 *   GITHUB_FILE   - Path to data file (default: "devices.json")
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO;
const GITHUB_FILE  = process.env.GITHUB_FILE || 'devices.json';

const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE}`;

/**
 * Read all devices from GitHub storage.
 * Returns { devices: {...}, sha: "abc123" }
 */
async function readDevices() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    // Fallback for when env vars aren't set (local dev)
    return { devices: {}, sha: null };
  }

  const res = await fetch(API_BASE, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'breatheio-platform'
    }
  });

  if (!res.ok) {
    if (res.status === 404) {
      // File doesn't exist yet — return empty
      return { devices: {}, sha: null };
    }
    throw new Error(`GitHub read failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { devices: JSON.parse(content), sha: data.sha };
}

/**
 * Write all devices to GitHub storage.
 * @param {object} devices - The full devices object
 * @param {string} sha - SHA of the current file (required for updates)
 */
async function writeDevices(devices, sha) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return;

  const body = {
    message: 'Update devices',
    content: Buffer.from(JSON.stringify(devices, null, 2)).toString('base64')
  };

  // Only include SHA for existing files (GitHub requires it for updates)
  if (sha) body.sha = sha;

  const res = await fetch(API_BASE, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'breatheio-platform',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`GitHub write failed: ${res.status} ${await res.text()}`);
  }
}

module.exports = { readDevices, writeDevices };
