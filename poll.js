require('dotenv').config();
const { Client } = require('@notionhq/client');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PROCESSED_FILE = '.processed_pages.json';

// Claude または Gemini を選択（.envで AI_PROVIDER=claude または gemini を指定）
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';

function loadProcessed() {
  try { return JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8')); }
  catch { return []; }
}

function saveProcessed(ids) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(ids));
}

async function getPageText(pageId) {
  const res = await notion.blocks.children.list({ block_id: pageId });
  return res.results
    .filter(b => b.type === 'paragraph' && b.paragraph.rich_text.length > 0)
    .map(b => b.paragraph.rich_text.map(t => t.plain_text).join(''))
    .join('\n');
}

const PROMPT = (title, text) =>
  `以下のミーティングのトランスクリプトを日本語で要約してください。\n\n【概要】（2〜3文）\n【決定事項】（箇条書き）\n【アクションアイテム】（誰が・何を）\n【次のステップ】\n\nタイトル: ${title}\nトランスクリプト:\n${text.slice(0, 30000)}`;

async function summarizeWithClaude(text, title) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: PROMPT(title, text) }],
  });
  return res.content[0].text;
}

async function summarizeWithGemini(text, title) {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { contents: [{ parts: [{ text: PROMPT(title, text) }] }] }
  );
  return res.data.candidates[0].content.parts[0].text;
}

async function summarize(text, title) {
  if (AI_PROVIDER === 'claude') return summarizeWithClaude(text, title);
  return summarizeWithGemini(text, title);
}

async function sendLine(message) {
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: process.env.LINE_GROUP_ID,
      messages: [{ type: 'text', text: message.slice(0, 5000) }],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

async function run() {
  const processed = loadProcessed();
  console.log(`[${now()}] 実行開始（AI: ${AI_PROVIDER}）`);

  try {
    const children = await notion.blocks.children.list({
      block_id: process.env.NOTION_PARENT_PAGE_ID,
    });

    const newPages = children.results.filter(
      b => b.type === 'child_page' && !processed.includes(b.id)
    );

    if (newPages.length === 0) {
      console.log('  → 新規ページなし');
      return;
    }

    for (const page of newPages) {
      const title = page.child_page.title;
      console.log(`  → 新規: ${title}`);

      const content = await getPageText(page.id);
      if (!content.trim()) {
        console.log('  → 内容なし、スキップ');
        processed.push(page.id);
        continue;
      }

      console.log('  → 要約中...');
      const summary = await summarize(content, title);

      console.log('  → LINE送信中...');
      await sendLine(`📋 ミーティング要約\n\n【${title}】\n\n${summary}`);

      console.log('  → 完了！');
      processed.push(page.id);
    }

    saveProcessed(processed);
  } catch (err) {
    console.error('[エラー]', err.response?.data || err.message);
  }
}

// 毎日17:00に実行
function scheduleDaily() {
  const HOUR = 17;

  setInterval(() => {
    const d = new Date();
    if (d.getHours() === HOUR && d.getMinutes() === 0) {
      run();
    }
  }, 60 * 1000); // 1分毎に時刻チェック

  console.log(`毎日 ${HOUR}:00 に自動実行します`);
  console.log('今すぐテストしたい場合は: node poll.js --now');
}

function now() {
  return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

// --now オプションで即時実行
if (process.argv.includes('--now')) {
  run();
} else {
  scheduleDaily();
}
