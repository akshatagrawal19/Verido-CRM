"use client";

import { useState, useEffect, useRef } from "react";
import type { Lead, EnrichedLead } from "./types";
import { STAGES, RESPONSE } from "./constants";
import { blank, enrich, computeStats, fmt, uid } from "./utils";
import { supabase } from "../lib/supabase";
import {
  IconPlus, IconUpload, IconDownload, IconRefresh, IconSearch,
  IconEdit, IconTrash, IconExt, IconX, IconUsers, IconSend,
  IconCheck, IconMail, IconMsg, IconAlert, IconLink,
} from "./icons";

/* ─── DB mappers ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Lead {
  return {
    id: r.id ?? uid(),
    name: r.name ?? "",
    company: r.company ?? "",
    title: r.title ?? "",
    linkedinUrl: r.linkedin_url ?? "",
    email: r.email ?? "",
    requestSent: r.request_sent ?? false,
    requestSentDate: r.request_sent_date ?? "",
    accepted: r.accepted ?? "pending",
    acceptedDate: r.accepted_date ?? "",
    followUpSent: r.follow_up_sent ?? false,
    followUpSentDate: r.follow_up_sent_date ?? "",
    response: r.response ?? "awaiting",
    notes: r.notes ?? "",
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

function toRow(l: Lead) {
  return {
    id: l.id,
    name: l.name,
    company: l.company,
    title: l.title,
    linkedin_url: l.linkedinUrl,
    email: l.email,
    request_sent: l.requestSent,
    request_sent_date: l.requestSentDate || null,
    accepted: l.accepted,
    accepted_date: l.acceptedDate || null,
    follow_up_sent: l.followUpSent,
    follow_up_sent_date: l.followUpSentDate || null,
    response: l.response,
    notes: l.notes,
  };
}

/* ─── Badge ─── */
function Badge({ color, soft, label }: { color: string; soft: string; label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "2px 9px",
      borderRadius: 999, whiteSpace: "nowrap", background: soft, color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {label}
    </span>
  );
}

/* ─── Stats cards ─── */
function StatsCards({ leads }: { leads: Lead[] }) {
  const s = computeStats(leads);
  function Card({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: number; sub: string; color: string }) {
    return (
      <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 150 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
          <span style={{ color, display: "inline-flex" }}>{icon}</span>{label}
        </div>
        <div style={{ fontFamily: "Fraunces,serif", fontSize: 34, lineHeight: 1, fontWeight: 600 }}>{value}</div>
        {sub && <div style={{ marginTop: 7, fontSize: 12.5, color: "var(--faint)" }}>{sub}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <Card icon={<IconUsers />} label="Leads" value={s.total} sub="in pipeline" color="var(--accent)" />
      <Card icon={<IconSend />} label="Requests" value={s.sent} sub={s.total ? `${Math.round(s.sent / s.total * 100)}% of leads` : "—"} color={STAGES.sent.color} />
      <Card icon={<IconCheck />} label="Connected" value={s.accepted} sub={s.sent ? `${Math.round(s.accepted / s.sent * 100)}% accept rate` : "—"} color={STAGES.connected.color} />
      <Card icon={<IconMail />} label="Followed up" value={s.followed} sub="" color={STAGES.followup.color} />
      <Card icon={<IconMsg />} label="Replied" value={s.responded} sub={`${s.positive} positive`} color={STAGES.responded.color} />
    </div>
  );
}

/* ─── Funnel ─── */
function Funnel({ leads }: { leads: Lead[] }) {
  const s = computeStats(leads);
  const steps = [
    { label: "Leads", value: s.total, color: STAGES.new.color },
    { label: "Requests sent", value: s.sent, color: STAGES.sent.color },
    { label: "Connected", value: s.accepted, color: STAGES.connected.color },
    { label: "Followed up", value: s.followed, color: STAGES.followup.color },
    { label: "Replied", value: s.responded, color: STAGES.responded.color },
  ];
  const max = Math.max(1, steps[0].value);
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 22 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--muted)", marginBottom: 16 }}>Outreach Funnel</div>
      {steps.map((st, i) => {
        const pct = Math.round(st.value / max * 100);
        const conv = i === 0 ? 100 : (steps[0].value ? Math.round(st.value / steps[0].value * 100) : 0);
        const w = Math.max(pct, st.value > 0 ? 7 : 0);
        return (
          <div key={st.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
            <div style={{ width: 116, fontSize: 13, fontWeight: 500, textAlign: "right" }}>{st.label}</div>
            <div style={{ flex: 1, height: 28, background: "var(--panel)", borderRadius: 7, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 7, display: "flex", alignItems: "center", paddingLeft: 10, width: `${w}%`, background: st.color, transition: "width .5s cubic-bezier(.2,.8,.2,1)" }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "Spline Sans Mono,monospace" }}>{st.value}</span>
              </div>
            </div>
            <div style={{ width: 44, fontSize: 12, color: "var(--faint)", fontFamily: "Spline Sans Mono,monospace", textAlign: "right" }}>{conv}%</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Shared UI primitives ─── */
function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(33,30,25,.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", zIndex: 50, overflowY: "auto" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg)", borderRadius: 18, border: "1px solid var(--borderStrong)", width: "100%", maxWidth: 600, padding: "24px 26px", boxShadow: "0 24px 60px rgba(33,30,25,.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "Fraunces,serif", fontSize: 24, fontWeight: 600, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 9, border: "none", background: "transparent", color: "var(--muted)", display: "inline-flex", cursor: "pointer" }}><IconX /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 5, display: "block", letterSpacing: ".02em" }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onToggle} style={{ flex: "0 0 110px", padding: "9px 11px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: `1px solid ${on ? "var(--accent)" : "var(--borderStrong)"}`, background: on ? "var(--accentSoft)" : "var(--paper)", color: on ? "var(--accent)" : "var(--muted)", textAlign: "left" }}>
      {children}
    </button>
  );
}

function Btn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: disabled ? "var(--borderStrong)" : "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7, cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}

function BtnGhost({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--borderStrong)", background: "var(--paper)", color: "var(--ink)", fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 7 }}>
      {children}
    </button>
  );
}

function IconBtn({ onClick, title, danger, children }: { onClick: () => void; title?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{ padding: 6, borderRadius: 9, border: "1px solid var(--border)", background: "var(--paper)", color: danger ? "#a8584a" : "var(--muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      {children}
    </button>
  );
}

/* ─── Lead Form Modal ─── */
function LeadFormModal({ lead, onSave, onClose }: { lead: Lead; onSave: (l: Lead) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ ...lead });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Lead, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({ ...form, name: form.name.trim() });
    setSaving(false);
  }

  return (
    <ModalShell title={lead.name ? "Edit lead" : "New lead"} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Name"><input value={form.name} placeholder="Jane Doe" onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Company"><input value={form.company} placeholder="Acme Inc." onChange={(e) => set("company", e.target.value)} /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Title / Role"><input value={form.title} placeholder="Co-founder & CEO" onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Email"><input value={form.email} placeholder="jane@acme.com" type="email" onChange={(e) => set("email", e.target.value)} /></Field>
        </div>
        <Field label="LinkedIn URL"><input value={form.linkedinUrl} placeholder="https://linkedin.com/in/…" onChange={(e) => set("linkedinUrl", e.target.value)} /></Field>
        <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Connection request">
            <div style={{ display: "flex", gap: 8 }}>
              <Toggle on={form.requestSent} onToggle={() => set("requestSent", !form.requestSent)}>{form.requestSent ? "Sent" : "Not sent"}</Toggle>
              <input type="date" value={form.requestSentDate} style={{ flex: 1 }} onChange={(e) => set("requestSentDate", e.target.value)} />
            </div>
          </Field>
          <Field label="Accepted?">
            <div style={{ display: "flex", gap: 8 }}>
              <select value={form.accepted} style={{ flex: "0 0 130px" }} onChange={(e) => set("accepted", e.target.value as Lead["accepted"])}>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="declined">No / Declined</option>
              </select>
              <input type="date" value={form.acceptedDate} style={{ flex: 1 }} onChange={(e) => set("acceptedDate", e.target.value)} />
            </div>
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Follow-up email">
            <div style={{ display: "flex", gap: 8 }}>
              <Toggle on={form.followUpSent} onToggle={() => set("followUpSent", !form.followUpSent)}>{form.followUpSent ? "Sent" : "Not sent"}</Toggle>
              <input type="date" value={form.followUpSentDate} style={{ flex: 1 }} onChange={(e) => set("followUpSentDate", e.target.value)} />
            </div>
          </Field>
          <Field label="Response">
            <select value={form.response} onChange={(e) => set("response", e.target.value as Lead["response"])}>
              <option value="awaiting">Awaiting</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </Field>
        </div>
        <Field label="Response / notes">
          <textarea value={form.notes} placeholder="What did they say? Next steps…" style={{ minHeight: 64, resize: "vertical" }} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
        <Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : lead.name ? "Save changes" : "Add lead"}</Btn>
      </div>
    </ModalShell>
  );
}

/* ─── Import Modal ─── */
function ImportModal({ onImport, onClose }: { onImport: (rows: Partial<Lead>[]) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const parsed = text.trim()
    ? text.trim().split("\n").filter(Boolean).map((line) => {
        const c = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.replace(/^"|"$/g, "").trim());
        return { name: c[0] || "", company: c[1] || "", title: c[2] || "", linkedinUrl: c[3] || "", email: c[4] || "" };
      }).filter((r) => r.name)
    : [];

  return (
    <ModalShell title="Import from your sheet" onClose={onClose}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "0 0 12px", lineHeight: 1.5 }}>
        Copy rows straight from your Google Sheet and paste below. One lead per line, columns in this order (tab or comma separated):
      </p>
      <div style={{ fontFamily: "Spline Sans Mono,monospace", fontSize: 12, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 11px", color: "var(--muted)", marginBottom: 12 }}>
        Name · Company · Title · LinkedIn URL · Email
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 150, resize: "vertical", fontFamily: "Spline Sans Mono,monospace", fontSize: 12.5 }} placeholder={"Jane Doe\tAcme Inc.\tCo-founder\thttps://linkedin.com/in/jane\tjane@acme.com"} />
      <div style={{ marginTop: 10, fontSize: 13, color: parsed.length ? STAGES.connected.color : "var(--faint)" }}>
        {parsed.length ? `${parsed.length} lead${parsed.length > 1 ? "s" : ""} detected` : "Nothing parsed yet"}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <BtnGhost onClick={onClose}>Cancel</BtnGhost>
        <Btn disabled={importing || !parsed.length} onClick={async () => { if (parsed.length) { setImporting(true); await onImport(parsed); setImporting(false); } }}>
          {importing ? "Importing…" : "Import"}
        </Btn>
      </div>
    </ModalShell>
  );
}

/* ─── Main page ─── */
type Modal = { type: "form"; lead: Lead } | { type: "import" } | null;

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadLeads() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("crm_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else { setLeads((data ?? []).map(fromRow)); setError(""); }
    setLoading(false);
  }

  useEffect(() => { loadLeads(); }, []);

  async function upsert(l: Lead) {
    setSaving(true);
    const { error: err } = await supabase.from("crm_leads").upsert(toRow(l));
    if (err) { setError(err.message); setSaving(false); return; }
    setModal(null);
    await loadLeads();
    setSaving(false);
  }

  async function remove(id: string) {
    const lead = leads.find((l) => l.id === id);
    if (!confirm(`Delete ${lead?.name || "this lead"}?`)) return;
    setSaving(true);
    await supabase.from("crm_leads").delete().eq("id", id);
    await loadLeads();
    setSaving(false);
  }

  async function importMany(rows: Partial<Lead>[]) {
    setSaving(true);
    const newLeads = rows.map((r) => ({ ...blank(), ...r, id: uid() }));
    const { error: err } = await supabase.from("crm_leads").insert(newLeads.map(toRow));
    if (err) setError(err.message);
    setModal(null);
    await loadLeads();
    setSaving(false);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(leads, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `crm-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function importFile(file: File) {
    const fr = new FileReader();
    fr.onload = async () => {
      try {
        const data = JSON.parse(fr.result as string);
        if (!Array.isArray(data)) throw new Error();
        if (!confirm(`Import ${data.length} record(s)?`)) return;
        setSaving(true);
        await supabase.from("crm_leads").upsert(data.map((r: Lead) => toRow({ ...blank(), ...r })));
        await loadLeads();
        setSaving(false);
      } catch { setError("That file isn't a valid CRM export."); }
    };
    fr.readAsText(file);
  }

  const enriched = enrich(leads);
  const term = q.trim().toLowerCase();
  const filtered = enriched.filter((l: EnrichedLead) => {
    if (filter !== "all" && l.stage !== filter) return false;
    if (!term) return true;
    return (l.name + l.company + l.title + l.email).toLowerCase().includes(term);
  });

  const counts: Record<string, number> = { all: enriched.length };
  Object.keys(STAGES).forEach((k) => { counts[k] = enriched.filter((l: EnrichedLead) => l.stage === k).length; });

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px 22px 80px" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 26 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--accent)", fontSize: 12.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 6 }}>
            <IconLink /> LinkedIn Outreach
          </div>
          <h1 style={{ fontFamily: "Fraunces,serif", fontSize: 42, fontWeight: 600, margin: 0, lineHeight: 1 }}>Pipeline CRM</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "9px 0 0", maxWidth: 460, lineHeight: 1.45 }}>
            Track every cofounder from first connection request through follow-up and reply. Synced to Supabase.
          </p>
        </div>
        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <IconBtn onClick={loadLeads} title="Reload from Supabase"><IconRefresh /></IconBtn>
          <BtnGhost onClick={exportJSON}><IconDownload /> Export</BtnGhost>
          <BtnGhost onClick={() => fileInputRef.current?.click()}><IconUpload /> Load file</BtnGhost>
          <BtnGhost onClick={() => setModal({ type: "import" })}><IconUpload /> Paste import</BtnGhost>
          <Btn onClick={() => setModal({ type: "form", lead: blank() })}><IconPlus /> Add lead</Btn>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.[0]) importFile(e.target.files[0]); e.currentTarget.value = ""; }} />
        </div>
      </header>

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f1e0dc", color: "#a8584a", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13.5 }}>
          <IconAlert /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Loading from Supabase…</div>
      ) : (
        <>
          <StatsCards leads={leads} />
          <Funnel leads={leads} />

          {/* Search + Tabs */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ position: "relative", flex: "1 1 230px", minWidth: 200 }}>
              <span style={{ position: "absolute", left: 12, top: 11, color: "var(--faint)" }}><IconSearch /></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email…" style={{ paddingLeft: 36 }} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[{ key: "all", label: "All", color: "#211e19" }, ...Object.values(STAGES).map((s) => ({ key: s.key, label: s.label, color: s.color }))].map((t) => (
                <button key={t.key} onClick={() => setFilter(t.key)} style={{ padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, border: `1px solid ${filter === t.key ? t.color : "var(--border)"}`, background: filter === t.key ? t.color : "var(--paper)", color: filter === t.key ? "#fff" : "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {t.label}
                  <span style={{ fontFamily: "Spline Sans Mono,monospace", fontSize: 11.5, opacity: filter === t.key ? 0.85 : 0.6 }}>{counts[t.key]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "60px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14, textAlign: "center" }}>
                <div style={{ fontFamily: "Fraunces,serif", fontSize: 21, color: "var(--ink)", marginBottom: 6 }}>{enriched.length === 0 ? "No leads yet" : "No matches"}</div>
                <div style={{ marginBottom: 16 }}>{enriched.length === 0 ? "Add your first lead or import from your sheet." : "Try a different filter or search."}</div>
                {enriched.length === 0 && (
                  <div style={{ display: "flex", gap: 9 }}>
                    <BtnGhost onClick={() => setModal({ type: "import" })}><IconUpload /> Import</BtnGhost>
                    <Btn onClick={() => setModal({ type: "form", lead: blank() })}><IconPlus /> Add lead</Btn>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
                  <thead>
                    <tr>
                      {["Lead", "Stage", "Request", "Accepted", "Follow-up", "Response", ""].map((h) => (
                        <th key={h} style={{ padding: "13px 16px", fontSize: 11.5, fontWeight: 700, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".06em", borderBottom: "1px solid var(--border)", background: "var(--panel)", whiteSpace: "nowrap", textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l: EnrichedLead) => {
                      const st = STAGES[l.stage];
                      const rs = RESPONSE[l.response] || RESPONSE.awaiting;
                      const initial = (l.name[0] || "?").toUpperCase();
                      const accColor = l.accepted === "accepted" ? STAGES.connected.color : l.accepted === "declined" ? STAGES.declined.color : "var(--faint)";
                      const accText = l.accepted === "accepted" ? "Yes" : l.accepted === "declined" ? "No" : "Pending";
                      return (
                        <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--panel)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}>
                          <td style={{ padding: "13px 16px", minWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0, fontFamily: "Fraunces,serif", background: st.soft, color: st.color }}>{initial}</div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
                                  {l.name || "Unnamed"}
                                  {l.linkedinUrl && <a href={l.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: STAGES.sent.color, display: "inline-flex" }}><IconExt /></a>}
                                </div>
                                <div style={{ fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 230 }}>{[l.title, l.company].filter(Boolean).join(" · ") || "—"}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 13 }}><Badge color={st.color} soft={st.soft} label={st.label} /></td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: l.requestSent ? "var(--ink)" : "var(--faint)", whiteSpace: "nowrap" }}>{l.requestSent ? fmt(l.requestSentDate) : "Not sent"}</td>
                          <td style={{ padding: "13px 16px", fontSize: 13, whiteSpace: "nowrap" }}><span style={{ color: accColor, fontWeight: 600 }}>{accText}</span></td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: l.followUpSent ? "var(--ink)" : "var(--faint)", whiteSpace: "nowrap" }}>{l.followUpSent ? fmt(l.followUpSentDate) : "—"}</td>
                          <td style={{ padding: "13px 16px", fontSize: 13 }}><Badge color={rs.color} soft={rs.soft} label={rs.label} /></td>
                          <td style={{ padding: "13px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                            <span style={{ marginRight: 5 }}>
                              <IconBtn onClick={() => setModal({ type: "form", lead: JSON.parse(JSON.stringify(l)) })} title="Edit"><IconEdit /></IconBtn>
                            </span>
                            <IconBtn onClick={() => remove(l.id)} title="Delete" danger><IconTrash /></IconBtn>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "var(--faint)" }}>
        <span>{saving ? "Saving…" : "Synced to Supabase."}</span>
        <span style={{ fontFamily: "Spline Sans Mono,monospace" }}>{enriched.length} {enriched.length === 1 ? "record" : "records"}</span>
      </div>

      {/* Modals */}
      {modal?.type === "form" && <LeadFormModal lead={modal.lead} onSave={upsert} onClose={() => setModal(null)} />}
      {modal?.type === "import" && <ImportModal onImport={importMany} onClose={() => setModal(null)} />}
    </div>
  );
}
