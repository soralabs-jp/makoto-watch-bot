const { config } = require("./config");

const DISCORD_MESSAGE_LIMIT = 1900;

async function notifyDiscord(lines, options = {}) {
  if (!config.discordWebhookUrl) {
    console.warn("[notifyDiscord] DISCORD_WEBHOOK_URL \u304c\u672a\u8a2d\u5b9a\u306e\u305f\u3081\u901a\u77e5\u3092\u30b9\u30ad\u30c3\u30d7\u3057\u307e\u3057\u305f");
    return;
  }

  const payloads = chunkMessages(lines, options.header);
  for (const content of payloads) {
    const response = await fetch(config.discordWebhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: config.discordUsername,
        avatar_url: config.discordAvatarUrl || undefined,
        content,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Discord\u901a\u77e5\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${response.status} ${responseText}`);
    }
  }
}

function chunkMessages(lines, header = "") {
  const normalizedLines = (lines || []).filter(Boolean);
  if (normalizedLines.length === 0 && !header) {
    return [];
  }

  const chunks = [];
  let current = header ? `${header}\n` : "";

  for (const line of normalizedLines) {
    const candidate = current ? `${current}${line}\n` : `${line}\n`;
    if (candidate.length > DISCORD_MESSAGE_LIMIT && current) {
      chunks.push(current.trimEnd());
      current = header ? `${header}\n${line}\n` : `${line}\n`;
      continue;
    }

    current = candidate;
  }

  if (current.trim()) {
    chunks.push(current.trimEnd());
  }

  return chunks;
}

module.exports = { notifyDiscord };
