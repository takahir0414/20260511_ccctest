require('dotenv').config();
const { Client } = require('@notionhq/client');
const axios = require('axios');
const fs = require('fs');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PROCESSED_FILE = '.processed_pages.json';
const POLL_INTERVAL = 5 * 60 * 1000; // 5分毎

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

async function summarize(text, title) {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [{
        parts: [{
          text: `以下のミーティングのトランスクリプトを日本語で要約してください。\n\n【概要】（2〜3文）\n【決定事項】（箇条書き）\n【アクションアイテム】（誰が・何を）\n【次のステップ】\n\nタイトル: ${title}\nトランスクリプト:\n${text.slice(0, 30000)}`
        }]
      }]
    }
  );
  return res.data.candidates[0].content.parts[0].text;
}

async function sendLine(message) {
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: process.env.LINE_GROUP_ID,
      messages: [{ type: 'text', text: message.slice(0, 5000) }]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

async function poll() {
  const processed = loadProcessed();

  try {
    const children = await notion.blocks.children.list({
      block_id: process.env.NOTION_PARENT_PAGE_ID,
    });

    const newPages = children.results.filter(
      b => b.type === 'child_page' && !processed.includes(b.id)
    );

    if (newPages.length === 0) {
      console.log(`[${new Date().toLocaleTimeString('ja-JP')}] 新規ページなし`);
      return;
    }

    for (const page of newPages) {
      const title = page.child_page.title;
      console.log(`[新規] ${title}`);

      const content = await getPageText(page.id);
      if (!content.trim()) {
        console.log('  → 内容なし、スキップ');
        processed.push(page.id);
        continue;
      }

      console.log('  → Geminiで要約中...');
      const summary = await summarize(content, title);

      console.log('  → LINEに送信中...');
      await sendLine(`📋 ミーティング要約\n\n【${title}】\n\n${summary}`);

      console.log('  → 完了！');
      processed.push(page.id);
    }

    saveProcessed(processed);
  } catch (err) {
    console.error('[エラー]', err.response?.data || err.message);
  }
}

console.log('監視開始（5分毎にNotionをチェック）');
poll();
setInterval(poll, POLL_INTERVAL);
