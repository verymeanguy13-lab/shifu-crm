// Session 9: Business Settings — full page (expands Session 8's LINE-only version)
"use client";

import { useEffect, useState } from "react";

const TRADE_TYPES = ["水電", "家電維修", "鎖匠", "木工", "裝修"];

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [statementNumber, setStatementNumber] = useState("");
  const [tradeTypes, setTradeTypes] = useState<string[]>([]);
  const [serviceArea, setServiceArea] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState<Record<string, number>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
        const b = data.business;
        if (b) {
          setName(b.name || "");
          setPhone(b.phone || "");
          setStatementNumber(b.statement_number || "");
          setTradeTypes(b.trade_types || []);
          setServiceArea(b.service_area || "");
          setWarrantyMonths(b.default_warranty_months || {});
          setLogoUrl(b.logo_url || null);
          setLineChannelToken(b.line_channel_token || "");
          setLineChannelSecret(b.line_channel_secret || "");
          setLineBotUserId(b.line_bot_user_id || "");
        }
        setLoading(false);
      });
  }, []);

  function toggleTradeType(t: string) {
    setTradeTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  function setWarrantyFor(t: string, months: number) {
    setWarrantyMonths((prev) => ({ ...prev, [t]: months }));
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/business/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `上傳失敗（狀態碼 ${res.status}）` }));
        alert(data.error || "上傳失敗");
        return;
      }

      const data = await res.json();
      setLogoUrl(data.url);
    } catch (err) {
      console.error("Logo upload error:", err);
      alert("上傳時發生錯誤，請稍後再試");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage(null);
    const res = await fetch("/api/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        statementNumber,
        tradeTypes,
        serviceArea,
        defaultWarrantyMonths: warrantyMonths,
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
        <h1 className="text-2xl font-semibold mb-6">商家設定</h1>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm mb-1">商家名稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">電話</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">統編（選填）</label>
            <input
              type="text"
              value={statementNumber}
              onChange={(e) => setStatementNumber(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">商家標誌 (Logo)</label>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-24 h-24 object-cover rounded mb-2 border" />
            )}
            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
            {uploadingLogo && <p className="text-sm text-gray-500">上傳中...</p>}
          </div>

          <div>
            <label className="block text-sm mb-2">服務項目</label>
            <div className="flex flex-wrap gap-3">
              {TRADE_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={tradeTypes.includes(t)}
                    onChange={() => toggleTradeType(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {tradeTypes.length > 0 && (
            <div>
              <label className="block text-sm mb-2">各服務項目預設保固月數</label>
              <div className="flex flex-col gap-2">
                {tradeTypes.map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-sm w-20">{t}</span>
                    <input
                      type="number"
                      min={0}
                      value={warrantyMonths[t] ?? 0}
                      onChange={(e) => setWarrantyFor(t, Number(e.target.value))}
                      className="w-24 border rounded px-2 py-1 text-sm"
                    />
                    <span className="text-sm text-gray-500">個月</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">服務區域</label>
            <input
              type="text"
              value={serviceArea}
              onChange={(e) => setServiceArea(e.target.value)}
              placeholder="例如：台北市、新北市"
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="border-t pt-4 mt-2">
            <h2 className="text-lg font-semibold mb-4">LINE 設定</h2>
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
            </div>
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
