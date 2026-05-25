import 'dotenv/config';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const pageId  = process.argv[2];
const summary = process.argv[3];

if (!pageId || !summary) {
  console.error('使い方: node update-page.js <page_id> "<summary>"');
  process.exit(1);
}

async function updatePage() {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        '要約': { rich_text: [{ text: { content: summary.slice(0, 2000) } }] },
        'ステータス': { select: { name: '要約済み' } }
      }
    });
  } catch {
    // プロパティが存在しない場合はスキップ
  }

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

  console.log(`✅ 書き込み完了: ${pageId}`);
}

updatePage().catch(console.error);
