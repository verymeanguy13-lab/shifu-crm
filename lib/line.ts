// Session 7: LINE Client
import crypto from "crypto";

export async function sendLineMessage(
  channelAccessToken: string,
  lineUserId: string,
  text: string
): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`LINE push message failed (${res.status}): ${errBody}`);
  }
}

export function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  const hash = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");

  // Constant-time comparison to avoid timing attacks.
  const hashBuffer = Buffer.from(hash);
  const signatureBuffer = Buffer.from(signature);

  if (hashBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
}
