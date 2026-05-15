/**
 * Zapier "Code by Zapier" step — tldv → Notion block chunker
 *
 * Problem: Notion's API rejects requests when body.children.length > 100.
 * tldv transcripts can produce 300+ blocks, which causes the Zap to fail.
 *
 * Solution: Split the children array into chunks of ≤ 100, then append each
 * chunk to the Notion page in sequence using the Notion API.
 *
 * Setup in Zapier:
 *   1. Add a "Code by Zapier" step (JavaScript) between tldv and Notion.
 *   2. In "Input Data", map:
 *        notionPageId  → the page ID created by the previous Notion step
 *        notionToken   → your Notion integration token (store in Zapier Storage)
 *        children      → the JSON string of blocks from tldv
 *   3. Replace the Notion step that fails with this code step.
 *      The code step itself calls the Notion API, so you can remove the
 *      broken Notion "Create page with children" step entirely.
 */

const NOTION_VERSION = '2022-06-28';
const CHUNK_SIZE = 100;

// --- helpers ----------------------------------------------------------------

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function appendBlocks(pageId, blocks, token) {
  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({ children: blocks }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error (${res.status}): ${err}`);
  }
  return res.json();
}

// --- main -------------------------------------------------------------------

const pageId    = inputData.notionPageId;
const token     = inputData.notionToken;
const rawBlocks = inputData.children;

if (!pageId)    throw new Error('notionPageId is required');
if (!token)     throw new Error('notionToken is required');
if (!rawBlocks) throw new Error('children is required');

const allBlocks = typeof rawBlocks === 'string' ? JSON.parse(rawBlocks) : rawBlocks;
const chunks    = chunkArray(allBlocks, CHUNK_SIZE);

const results = [];
for (const chunk of chunks) {
  const result = await appendBlocks(pageId, chunk, token);
  results.push(result);
}

output = {
  success:     true,
  totalBlocks: allBlocks.length,
  totalChunks: chunks.length,
  pageId,
};
