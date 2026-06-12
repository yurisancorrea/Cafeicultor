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

app.post('/screenshot', async (req, res) => {
  const { html, width = 1080, height = 1920 } = req.body || {};

  if (!html) {
    return res.status(400).json({ error: 'html is required' });
  }

  let browser, page;
  try {
    browser = await puppeteer.launch(LAUNCH_OPTS);
    page = await browser.newPage();
    await page.setViewport({
      width: parseInt(width),
      height: parseInt(height),
      deviceScaleFactor: 1
    });
    await page.setContent(html, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });
    // Aguarda fontes web carregarem
    await new Promise(r => setTimeout(r, 800));

    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: parseInt(width), height: parseInt(height) }
    });

    res.set('Content-Type', 'image/png');
    res.send(buf);

  } catch (err) {
    console.error('[screenshot error]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Screenshot service running on :${PORT}`));
