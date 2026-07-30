// Session 10: Customer Management — list, search, add/edit modal
"use client";

import { useEffect, useState, useCallback } from "react";
import type { Customer } from "@/types/crm";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async (searchTerm: string) => {
    setLoading(true);
    const url = searchTerm
      ? `/api/customers?search=${encodeURIComponent(searchTerm)}`
      : "/api/customers";
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    setCustomers(data.customers || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCustomers("");
  }, [loadCustomers]);

  useEffect(() => {
    const timeout = setTimeout(() => loadCustomers(search), 300);
    return () => clearTimeout(timeout);
  }, [search, loadCustomers]);

  function openAddModal() {
    setEditingCustomer(null);
    setFormName("");
    setFormPhone("");
    setFormNotes("");
    setModalOpen(true);
  }

  function openEditModal(c: Customer) {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone || "");
    setFormNotes(c.notes || "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      alert("請輸入姓名");
      return;
    }
    setSaving(true);
    try {
      if (editingCustomer) {
        await fetch(`/api/customers/${editingCustomer.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, phone: formPhone, notes: formNotes }),
        });
      } else {
        await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: formName, phone: formPhone, notes: formNotes }),
        });
      }
      setModalOpen(false);
      await loadCustomers(search);
    } catch (err) {
      alert("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`確定要刪除「${c.name}」嗎？`)) return;
    await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
    await loadCustomers(search);
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">客戶</h1>
        <button
          onClick={openAddModal}
          className="bg-black text-white rounded px-4 py-2 text-sm"
        >
          + 新增客戶
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋姓名或電話"
        className="w-full border rounded px-3 py-2 mb-4"
      />

      {loading ? (
        <p className="text-sm text-gray-500">載入中...</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-gray-500">尚無客戶資料</p>
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map((c) => (
            <div
              key={c.id}
              className="border rounded px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
                {c.notes && <p className="text-sm text-gray-400 mt-1">{c.notes}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(c)}
                  className="text-sm underline"
                >
                  編輯
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="text-sm text-red-600 underline"
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-sm flex flex-col gap-4">
            <h2 className="text-lg font-semibold">
              {editingCustomer ? "編輯客戶" : "新增客戶"}
            </h2>
            <div>
              <label className="block text-sm mb-1">姓名</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">電話</label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">備註</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                {saving ? "儲存中..." : "儲存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}