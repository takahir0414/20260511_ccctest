const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// トランスクリプトをNotionデータベースに新規ページとして保存
async function saveTranscriptToNotion(meeting) {
  const date = new Date(meeting.date).toISOString().split('T')[0];

  // トランスクリプトを2000文字ずつのブロックに分割（Notion API上限対応）
  const transcriptBlocks = splitIntoBlocks(meeting.transcript, 2000).map(chunk => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: chunk } }],
    },
  }));

  const response = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      // データベースの「名前」列（タイトル列）
      Name: {
        title: [{ text: { content: meeting.title } }],
      },
      // 日付列
      Date: {
        date: { start: date },
      },
      // 参加者列（マルチセレクト or テキストに合わせて調整）
      Participants: {
        rich_text: [
          {
            text: {
              content: meeting.participants.length > 0
                ? meeting.participants.map(p => p.name || p.email || p).join(', ')
                : '不明',
            },
          },
        ],
      },
      // tl;dv録画URL
      RecordingURL: meeting.recordingUrl
        ? { url: meeting.recordingUrl }
        : { url: null },
    },
    children: [
      // セクション見出し
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'トランスクリプト' } }],
        },
      },
      ...transcriptBlocks,
    ],
  });

  const pageId = response.id;
  return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
}

// 要約をNotionページに追記
async function updatePageWithSummary(pageUrl, summary) {
  // URLからページIDを抽出
  const pageId = extractPageId(pageUrl);

  const summaryBlocks = splitIntoBlocks(summary, 2000).map(chunk => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: chunk } }],
    },
  }));

  // ページの先頭にAI要約セクションを追加
  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: 'block',
        type: 'divider',
        divider: {},
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '🤖 AI要約' } }],
        },
      },
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [{ type: 'text', text: { content: summary.slice(0, 2000) } }],
          icon: { emoji: '✨' },
          color: 'blue_background',
        },
      },
      ...summaryBlocks.slice(1),
    ],
  });
}

function extractPageId(url) {
  // https://www.notion.so/abc123... からIDを取り出す
  const match = url.match(/([a-f0-9]{32})$/);
  if (match) {
    const id = match[1];
    return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
  }
  // すでにハイフン付きID形式の場合
  return url.split('/').pop();
}

function splitIntoBlocks(text, maxLength) {
  if (!text) return ['（トランスクリプトなし）'];
  const blocks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    blocks.push(text.slice(i, i + maxLength));
  }
  return blocks;
}

module.exports = { saveTranscriptToNotion, updatePageWithSummary };
