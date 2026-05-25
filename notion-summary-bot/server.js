import express from 'express';
import { execFile } from 'child_process';

const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  const { page_id } = req.body;

  if (!page_id) {
    return res.status(400).json({ error: 'page_id が必要です' });
  }

  res.json({ status: 'started', page_id });

  const env = { ...process.env, NOTION_PAGE_ID: page_id };
  execFile('node', ['summarize.js', page_id], { env }, (err, stdout, stderr) => {
    if (err) {
      console.error(`❌ [${page_id}]`, stderr || err.message);
    } else {
      console.log(stdout);
    }
  });
});

app.get('/', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 起動中 http://localhost:${PORT}`));
