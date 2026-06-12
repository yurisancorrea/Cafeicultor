const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '20mb' }));

const LAUNCH_OPTS = {
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--disable-accelerated-2d-canvas'
  ]
};

// Singleton browser — lançado uma vez e reutilizado para todos os requests
let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    if (browser) {
      await browser.close().catch(() => {});
    }
    console.log('[browser] launching new instance');
    browser = await puppeteer.launch(LAUNCH_OPTS);
    browser.on('disconnected', () => {
      console.log('[browser] disconnected — will relaunch on next request');
      browser = null;
    });
  }
  return browser;
}

// Mutex simples para evitar concorrência
let busy = false;
const queue = [];

function withLock(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    drain();
  });
}

async function drain() {
  if (busy || queue.length === 0) return;
  busy = true;
  const { fn, resolve, reject } = queue.shift();
  try {
    resolve(await fn());
  } catch (err) {
    reject(err);
  } finally {
    busy = false;
    drain();
  }
}

app.post('/screenshot', (req, res) => {
  const { html, width = 1080, height = 1920 } = req.body || {};

  if (!html) {
    return res.status(400).json({ error: 'html is required' });
  }

  withLock(async () => {
    let page;
    try {
      const b = await getBrowser();
      page = await b.newPage();
      await page.setViewport({
        width: parseInt(width),
        height: parseInt(height),
        deviceScaleFactor: 1
      });
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      const buf = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: parseInt(width), height: parseInt(height) }
      });

      res.set('Content-Type', 'image/png');
      res.send(buf);

    } catch (err) {
      console.error('[screenshot error]', err.message);
      // Reset browser em caso de erro para próximo request começar limpo
      if (browser) {
        await browser.close().catch(() => {});
        browser = null;
      }
      res.status(500).json({ error: err.message });
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }).catch(err => {
    console.error('[queue error]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now(), browserConnected: !!(browser && browser.isConnected()) }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Screenshot service running on :${PORT}`);
  try {
    await getBrowser();
    console.log('[browser] pre-launched successfully');
  } catch (err) {
    console.error('[browser] pre-launch failed:', err.message);
  }
});
