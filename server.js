// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const youtubedl = require('yt-dlp-exec');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

// 1) Audio‑only HLS manifest endpoint
app.get('/api/audio-hls/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const ua  = req.get('user-agent') || 'mozilla/5.0';

    const info = await youtubedl(url, {
      dumpSingleJson:     true,
      geoBypass:          true,          // <-- enable geo‑bypass
      geoBypassCountry:  'US',           // <-- pretend origin in US
      noCheckCertificates:true,
      addHeader: [
        'referer:youtube.com',
        `user-agent:${ua}`
      ]
    });

    const hlsAudio = (info.formats || []).find(f =>
      f.protocol?.includes('m3u8') &&
      f.acodec !== 'none' &&
      f.vcodec === 'none'
    );
    if (!hlsAudio) {
      return res.status(404).json({ error: 'No HLS audio format found' });
    }

    const manifestResp = await axios.get(hlsAudio.url);
    const server = getBaseUrl(req);

    const proxied = manifestResp.data.replace(
      /(https?:\/\/[^\s"']+?)(?=\r?\n)/g,
      url => `${server}/proxy/segment?url=${encodeURIComponent(url)}`
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    return res.send(proxied);

  } catch (err) {
    console.error('❌ yt-dlp error:', err.stderr || err.message);
    return res.status(500).json({ error: err.stderr?.trim() || 'yt-dlp failed' });
  }
});

// 2) Generic manifest proxy
app.get('/proxy/manifest', async (req, res) => {
  const manifestUrl = req.query.url;
  if (!manifestUrl) return res.status(400).json({ error: 'Missing manifest URL' });

  try {
    const { data: manifest } = await axios.get(manifestUrl);
    const server = getBaseUrl(req);
    const proxied = manifest.replace(
      /(https?:\/\/[^\s"']+?)(?=\r?\n)/g,
      url => `${server}/proxy/segment?url=${encodeURIComponent(url)}`
    );
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    return res.send(proxied);

  } catch (err) {
    console.error('❌ manifest proxy error:', err.message);
    return res.status(500).json({ error: 'Failed to proxy manifest' });
  }
});

// 3) Segment proxy
app.get('/proxy/segment', async (req, res) => {
  const segmentUrl = req.query.url;
  if (!segmentUrl) return res.status(400).json({ error: 'Missing segment URL' });

  try {
    const upstream = await axios.get(segmentUrl, { responseType: 'stream' });
    res.setHeader('Content-Type', upstream.headers['content-type']);
    return upstream.data.pipe(res);
  } catch (err) {
    console.error('❌ segment proxy error:', err.message);
    return res.status(500).json({ error: 'Failed to proxy segment' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Audio HLS proxy listening on port ${PORT}`);
});
