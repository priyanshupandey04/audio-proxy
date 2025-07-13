// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const youtubedl = require('yt-dlp-exec'); // ✅ instead of youtube-dl-exec
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// 🎯 1) Audio‐only HLS manifest endpoint
app.get('/api/audio-hls/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).end();

  try {
    const info = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      addHeader: ['referer:youtube.com', 'user-agent:googlebot']
    });

    const hlsAudio = (info.formats || []).find(f =>
      f.protocol && f.protocol.includes('m3u8') &&
      f.acodec !== 'none' && f.vcodec === 'none'
    );
    if (!hlsAudio) return res.status(404).end('No HLS audio');

    const { data: manifest } = await axios.get(hlsAudio.url);

    // 🛠️ Fixed: Use dynamic server URL (not localhost)
    const server = `${req.protocol}://${req.headers.host}`;
    const proxied = manifest.replace(
      /(https?:\/\/[^\s"']+?)(?=\r?\n)/g,
      url => `${server}/proxy/segment?url=${encodeURIComponent(url)}`
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(proxied);

  } catch (err) {
    console.error(err);
    res.status(500).end('Server error');
  }
});

// 🎯 2) Proxy and rewrite the manifest
app.get('/proxy/manifest', async (req, res) => {
  const manifestUrl = req.query.url;
  if (!manifestUrl) return res.status(400).json({ error: 'Missing manifest URL' });

  try {
    const { data: manifest } = await axios.get(manifestUrl);

    // 🛠️ Fixed: Use dynamic server URL
    const server = `${req.protocol}://${req.headers.host}`;
    const proxied = manifest.replace(
      /(https?:\/\/[^\s"']+?)(?=\r?\n)/g,
      url => `${server}/proxy/segment?url=${encodeURIComponent(url)}`
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(proxied);

  } catch (err) {
    console.error('❌ manifest proxy error:', err.message);
    res.status(500).json({ error: 'Failed to proxy manifest' });
  }
});

// 🎯 3) Proxy each segment
app.get('/proxy/segment', async (req, res) => {
  const segmentUrl = req.query.url;
  if (!segmentUrl) return res.status(400).json({ error: 'Missing segment URL' });

  try {
    const upstream = await axios.get(segmentUrl, { responseType: 'stream' });
    res.setHeader('Content-Type', upstream.headers['content-type']);
    upstream.data.pipe(res);
  } catch (err) {
    console.error('❌ segment proxy error:', err.message);
    res.status(500).json({ error: 'Failed to proxy segment' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Audio HLS proxy running on http://localhost:${PORT}`);
});
