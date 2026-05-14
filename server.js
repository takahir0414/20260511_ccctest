require('dotenv').config();
const express = require('express');
const { saveTranscriptToNotion } = require('./notion');
const { summarizeTranscript } = require('./summarize');
const { sendLineMessage } = require('./line');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// tl;dv webhook エンドポイント
app.post('/webhook/tldv', async (req, res) => {
  // 署名検証（tl;dvがsecretを設定している場合）
  const secret = process.env.TLDV_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers['x-tldv-signature'];
    if (signature !== secret) {
      console.warn('[webhook] 署名不一致 - リクエストを拒否');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const payload = req.body;
  console.log('[webhook] イベント受信:', payload.event || payload.type);

  // tl;dvの録画完了イベントのみ処理
  const event = payload.event || payload.type || '';
  if (!['recording_ready', 'transcript_ready', 'meeting_transcribed'].includes(event)) {
    return res.status(200).json({ message: 'ignored' });
  }

  // レスポンスを即返し、処理を非同期で実行
  res.status(200).json({ message: 'accepted' });

  try {
    await processRecording(payload);
  } catch (err) {
    console.error('[webhook] 処理中にエラー:', err.message);
  }
});

// ヘルスチェック
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function processRecording(payload) {
  const meeting = extractMeetingData(payload);
  console.log(`[処理開始] ミーティング: ${meeting.title}`);

  // 1. Notionにトランスクリプトを保存
  console.log('[Step 1] Notionへ保存中...');
  const notionPageUrl = await saveTranscriptToNotion(meeting);
  console.log('[Step 1] 完了:', notionPageUrl);

  // 2. Claude APIでAI要約を生成
  console.log('[Step 2] AI要約を生成中...');
  const summary = await summarizeTranscript(meeting);
  console.log('[Step 2] 要約完了');

  // 3. Notionページに要約を追記
  console.log('[Step 3] Notionに要約を追記中...');
  const { updatePageWithSummary } = require('./notion');
  await updatePageWithSummary(notionPageUrl, summary);
  console.log('[Step 3] 完了');

  // 4. グループLINEに送信
  console.log('[Step 4] LINEに送信中...');
  const lineMessage = buildLineMessage(meeting, summary, notionPageUrl);
  await sendLineMessage(lineMessage);
  console.log('[Step 4] 完了 - 全処理終了');
}

function extractMeetingData(payload) {
  // tl;dvのwebhookペイロード構造に対応
  const meeting = payload.meeting || payload.data || payload;
  const transcript = meeting.transcript || payload.transcript || [];

  return {
    id: meeting.id || payload.id || 'unknown',
    title: meeting.title || meeting.name || '無題のミーティング',
    date: meeting.date || meeting.started_at || meeting.created_at || new Date().toISOString(),
    duration: meeting.duration || null,
    participants: meeting.participants || meeting.attendees || [],
    transcript: Array.isArray(transcript)
      ? transcript
          .map(t => `${t.speaker || t.name || '不明'}: ${t.text || t.content || ''}`)
          .join('\n')
      : String(transcript),
    recordingUrl: meeting.recording_url || meeting.url || null,
  };
}

function buildLineMessage(meeting, summary, notionUrl) {
  const date = new Date(meeting.date).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const participants = meeting.participants.length > 0
    ? meeting.participants.map(p => p.name || p.email || p).join(', ')
    : '不明';

  return [
    `📋 ミーティング録画まとまりました！`,
    ``,
    `【${meeting.title}】`,
    `📅 日時: ${date}`,
    `👥 参加者: ${participants}`,
    ``,
    `📝 AI要約:`,
    summary,
    ``,
    `🔗 Notionで全文を見る: ${notionUrl}`,
  ].join('\n');
}

app.listen(PORT, () => {
  console.log(`tl;dv Webhook サーバー起動 → http://localhost:${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/tldv`);
});
