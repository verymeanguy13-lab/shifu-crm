// Session 8: Business Settings — LINE fields only.
// Session 9 adds more fields (name, phone, trade types, etc.) to this
// same page.
"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [lineChannelToken, setLineChannelToken] = useState("");
  const [lineChannelSecret, setLineChannelSecret] = useState("");
  const [lineBotUserId, setLineBotUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [testUserId, setTestUserId] = useState("");
  const [testText, setTestText] = useState("這是一則測試訊息");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business")
      .then((res) => res.json())
      .then((data) => {
        if (data.business) {
          setLineChannelToken(data.business.line_channel_token || "");
          setLineChannelSecret(data.business.line_channel_secret || "");
          setLineBotUserId(data.business.line_bot_user_id || "");
        }
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    const res = await fetch("/api/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineChannelToken,
        lineChannelSecret,
        lineBotUserId,
      }),
    });
    setSaving(false);
    setSaveMessage(res.ok ? "已儲存" : "儲存失敗");
  }

  async function handleSendTest() {
    setTestSending(true);
    setTestResult(null);
    const res = await fetch("/api/line/test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId: testUserId, text: testText }),
    });
    const data = await res.json();
    setTestSending(false);
    setTestResult(res.ok ? "已送出，請確認 LINE 是否收到" : data.error || "傳送失敗");
  }

  if (loading) return <div className="p-6">載入中...</div>;

  return (
    <div className="max-w-xl mx-auto mt-12 p-6 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold mb-6">LINE 設定</h1>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm mb-1">Channel Access Token</label>
            <input
              type="password"
              value={lineChannelToken}
              onChange={(e) => setLineChannelToken(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Channel Secret</label>
            <input
              type="password"
              value={lineChannelSecret}
              onChange={(e) => setLineChannelSecret(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Bot User ID</label>
            <input
              type="text"
              value={lineBotUserId}
              onChange={(e) => setLineBotUserId(e.target.value)}
              placeholder="U4af4980629..."
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50 self-start"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
          {saveMessage && <p className="text-sm text-gray-600">{saveMessage}</p>}
        </div>
      </div>

      <div className="border-t pt-8">
        <h2 className="text-lg font-semibold mb-4">傳送測試訊息</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm mb-1">你的 LINE User ID</label>
            <input
              type="text"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              placeholder="U..."
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">訊息內容</label>
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <button
            onClick={handleSendTest}
            disabled={testSending}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50 self-start"
          >
            {testSending ? "傳送中..." : "Send Test Message"}
          </button>
          {testResult && <p className="text-sm text-gray-600">{testResult}</p>}
        </div>
      </div>
    </div>
  );
}
