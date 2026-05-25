import 'dotenv/config';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function fetchUnprocessedPages() {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID,
    filter: {
      property: 'ステータス',
      select: { equals: '未要約' }
    }
  });

  const pages = response.results.length > 0
    ? response.results
    : (await notion.databases.query({ database_id: process.env.NOTION_DATABASE_ID })).results;

  const results = [];

  for (const page of pages) {
    const blocks = await notion.blocks.children.list({ block_id: page.id });
    const text = blocks.results
      .filter(b => b.type === 'paragraph')
      .map(b => b.paragraph.rich_text.map(t => t.plain_text).join(''))
      .filter(t => t.trim())
      .join('\n');

    const title = page.properties?.['名前']?.title?.[0]?.plain_text
      || page.properties?.['title']?.title?.[0]?.plain_text
      || '（タイトルなし）';

    results.push({ id: page.id, title, transcript: text });
  }

  console.log(JSON.stringify(results, null, 2));
}

fetchUnprocessedPages().catch(console.error);
