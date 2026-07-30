/**
 * GET /api/dbg
 * Debug: tests Vercel Blob connectivity. Returns everything — no silent handling.
 */
module.exports = async (req, res) => {
  const result = {
    env: {
      hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
      tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN
        ? process.env.BLOB_READ_WRITE_TOKEN.substring(0, 15) + '...'
        : 'MISSING',
      hasStoreId: !!process.env.BLOB_STORE_ID,
    },
    blobTest: null,
    error: null,
  };

  let blobModule;
  try {
    blobModule = require('@vercel/blob');
    result.importOk = true;
    result.hasPut = typeof blobModule.put === 'function';
    result.hasHead = typeof blobModule.head === 'function';
  } catch (importErr) {
    result.importOk = false;
    result.importError = importErr.message;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result, null, 2));
  }

  const { put, head } = blobModule;

  try {
    const testData = { test: true, time: Date.now() };
    const putResult = await put('_test.json', JSON.stringify(testData), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    result.blobTest = { writeOk: true, url: putResult.url };
  } catch (writeErr) {
    result.blobTest = {
      writeOk: false,
      writeError: writeErr.message,
      writeStack: writeErr.stack,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result, null, 2));
  }

  try {
    const info = await head('_test.json');
    const resp = await fetch(info.url);
    const text = await resp.text();
    result.blobTest.readOk = true;
    result.blobTest.readContent = text;
  } catch (readErr) {
    result.blobTest.readOk = false;
    result.blobTest.readError = readErr.message;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result, null, 2));
};
