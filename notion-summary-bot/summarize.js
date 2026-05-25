import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@notionhq/client';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const pageId = process.argv[2] || process.env.NOTION_PAGE_ID;

if (!pageId) {
  console.error('使い方: node summarize.js <notion_page_id>');
  process.exit(1);
}

async function run() {
  console.log(`📄 Notionページ取得中: ${pageId}`);

  const blocks = await notion.blocks.children.list({ block_id: pageId });

  const transcript = blocks.results
    .filter(b => b.type === 'paragraph')
    .map(b => b.paragraph.rich_text.map(t => t.plain_text).join(''))
    .join('\n')
    .trim();

  if (!transcript) {
    console.log('⚠️  トランスクリプトが空です。スキップします。');
    process.exit(0);
  }

  console.log(`🤖 Claudeで要約中...`);

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `以下の会議トランスクリプトを日本語で要約してください。\n\n## 📋 概要\n（2〜3文で全体を要約）\n\n## ✅ 決定事項\n（箇条書き）\n\n## 🎯 アクションアイテム\n（担当者・期限があれば含める）\n\n---\n${transcript}`
    }]
  });

  const summary = message.content[0].text;
  console.log('✅ 要約完了');

  await notion.pages.update({
    page_id: pageId,
    properties: {
      '要約': {
        rich_text: [{ text: { content: summary.slice(0, 2000) } }]
      },
      'ステータス': {
        select: { name: '要約済み' }
      }
    }
  });

  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        type: 'callout',
        callout: {
          rich_text: [{ text: { content: summary } }],
          icon: { emoji: '🤖' },
          color: 'blue_background'
        }
      },
      { type: 'divider', divider: {} }
    ]
  });

  console.log(`📝 Notionに書き込み完了: ${pageId}`);
}

run().catch(err => {
  console.error('エラー:', err.message);
  process.exit(1);
});
