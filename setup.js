const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  console.log('\n=== tl;dv → Notion → LINE 自動化セットアップ ===\n');

  const notionKey = await ask('① Notion APIキー（secret_...）: ');
  const geminiKey = await ask('② Gemini APIキー（AIzaSy...）: ');
  const lineToken = await ask('③ LINE Channel Access Token: ');
  const lineGroup = await ask('④ LINE グループID（C...）: ');

  const env = `AI_PROVIDER=gemini
NOTION_API_KEY=${notionKey.trim()}
NOTION_PARENT_PAGE_ID=35fbaf726af480a7aaeec8d07884951b
GEMINI_API_KEY=${geminiKey.trim()}
LINE_CHANNEL_ACCESS_TOKEN=${lineToken.trim()}
LINE_GROUP_ID=${lineGroup.trim()}
`;

  fs.writeFileSync('.env', env);
  console.log('\n.env ファイルを作成しました！');
  console.log('\n次のコマンドを実行してください:');
  console.log('  npm install');
  console.log('  node poll.js --now   ← テスト実行');
  console.log('  node poll.js         ← 毎日17時に自動実行');
  rl.close();
}

main();
