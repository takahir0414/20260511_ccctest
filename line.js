const axios = require('axios');

const LINE_NOTIFY_URL = 'https://notify-api.line.me/api/notify';

// LINE Notifyでグループに送信
async function sendLineMessage(message) {
  const token = process.env.LINE_NOTIFY_TOKEN;
  if (!token) throw new Error('LINE_NOTIFY_TOKEN が設定されていません');

  // LINE Notifyの1メッセージあたりの上限は1000文字
  const chunks = splitMessage(message, 1000);

  for (const chunk of chunks) {
    await axios.post(
      LINE_NOTIFY_URL,
      new URLSearchParams({ message: chunk }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
  }
}

function splitMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if ((current + '\n' + line).length > maxLength) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

module.exports = { sendLineMessage };
