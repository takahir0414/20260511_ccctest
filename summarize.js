const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function summarizeTranscript(meeting) {
  const transcriptText = meeting.transcript || '（トランスクリプトなし）';

  // トランスクリプトが長すぎる場合は先頭から100,000文字に切り詰め
  const truncated = transcriptText.slice(0, 100_000);
  const wasTruncated = truncated.length < transcriptText.length;

  const systemPrompt = `あなたはミーティングの議事録を作成するアシスタントです。
トランスクリプトを読み、以下の形式で簡潔にまとめてください：

1. **概要**（2〜3文で全体像）
2. **主な議題・決定事項**（箇条書き）
3. **アクションアイテム**（誰が・何を・いつまでに）
4. **次のステップ**

日本語で回答してください。LINEで読みやすいようにシンプルかつ簡潔に。`;

  const userPrompt = `以下のミーティングのトランスクリプトを要約してください。
${wasTruncated ? '※ 長いため冒頭部分のみ処理しています\n' : ''}
ミーティング名: ${meeting.title}
日時: ${new Date(meeting.date).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

--- トランスクリプト ---
${truncated}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return response.content[0].text;
}

module.exports = { summarizeTranscript };
