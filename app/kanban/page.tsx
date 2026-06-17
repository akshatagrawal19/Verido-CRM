"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  DndContext, DragOverlay, closestCorners,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  horizontalListSortingStrategy, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../lib/supabase";

/* ─── Types ─── */
type Priority = "low" | "medium" | "high" | "urgent";

interface KanbanMember { id: string; name: string; initials: string; color: string; }
interface KanbanLabel  { id: string; name: string; color: string; }
interface KanbanCard   { id: string; title: string; description: string; columnId: string; assigneeIds: string[]; priority: Priority; dueDate: string; labelIds: string[]; order: number; createdAt: string; }
interface KanbanColumn { id: string; title: string; order: number; color: string; }
interface BoardState   { columns: KanbanColumn[]; cards: KanbanCard[]; members: KanbanMember[]; labels: KanbanLabel[]; }

/* ─── DB mappers ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function colFromRow(r: any): KanbanColumn   { return { id: r.id, title: r.title, order: r.ord, color: r.color }; }
function colToRow(c: KanbanColumn)          { return { id: c.id, title: c.title, ord: c.order, color: c.color }; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cardFromRow(r: any): KanbanCard    { return { id: r.id, title: r.title, description: r.description ?? "", columnId: r.column_id, assigneeIds: r.assignee_ids ?? [], priority: r.priority ?? "medium", dueDate: r.due_date ?? "", labelIds: r.label_ids ?? [], order: r.ord ?? 0, createdAt: r.created_at ?? new Date().toISOString() }; }
function cardToRow(c: KanbanCard)           { return { id: c.id, title: c.title, description: c.description, column_id: c.columnId, assignee_ids: c.assigneeIds, priority: c.priority, due_date: c.dueDate, label_ids: c.labelIds, ord: c.order }; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function memberFromRow(r: any): KanbanMember { return { id: r.id, name: r.name, initials: r.initials, color: r.color }; }

/* ─── Constants ─── */
const DEFAULT_MEMBERS: KanbanMember[] = [
  { id: "m1", name: "Alex Johnson", initials: "AJ", color: "#3f6cb0" },
  { id: "m2", name: "Sam Rivera",   initials: "SR", color: "#2f7d5b" },
  { id: "m3", name: "Taylor Chen",  initials: "TC", color: "#bf8a2d" },
  { id: "m4", name: "Jordan Kim",   initials: "JK", color: "#b8431f" },
];

const DEFAULT_LABELS: KanbanLabel[] = [
  { id: "l1", name: "Bug",      color: "#a8584a" },
  { id: "l2", name: "Feature",  color: "#3f6cb0" },
  { id: "l3", name: "Design",   color: "#bf8a2d" },
  { id: "l4", name: "Backend",  color: "#2f7d5b" },
  { id: "l5", name: "Frontend", color: "#7c5cbf" },
  { id: "l6", name: "Urgent",   color: "#c1567a" },
];

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "col-new",      title: "New Task",    order: 0, color: "#8a8276" },
  { id: "col-progress", title: "In Progress", order: 1, color: "#3f6cb0" },
  { id: "col-review",   title: "Review",      order: 2, color: "#bf8a2d" },
  { id: "col-done",     title: "Done",        order: 3, color: "#2f7d5b" },
];

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; soft: string }> = {
  low:    { label: "Low",    color: "#4a9d6f", soft: "#e0f5eb" },
  medium: { label: "Medium", color: "#bf8a2d", soft: "#f5ecd8" },
  high:   { label: "High",   color: "#e07a3a", soft: "#fce8d8" },
  urgent: { label: "Urgent", color: "#c1567a", soft: "#f8e0e9" },
};

const COLUMN_COLOR_OPTIONS = ["#8a8276","#3f6cb0","#2f7d5b","#bf8a2d","#b8431f","#7c5cbf","#c1567a","#1e8fa3","#4d7c0f"];
const MEMBER_COLOR_OPTIONS  = ["#3f6cb0","#2f7d5b","#bf8a2d","#b8431f","#7c5cbf","#c1567a","#1e8fa3","#606060","#4d7c0f"];

/* ─── Utilities ─── */
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function toInitials(name: string) { return name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?"; }
function fmtDate(iso: string) { if (!iso) return ""; return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function isPast(iso: string) { if (!iso) return false; return new Date(iso + "T23:59:59") < new Date(); }

/* ─── Icons ─── */
function IcoPlus({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function IcoX({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>; }
function IcoEdit({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }
function IcoTrash({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>; }
function IcoDots({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>; }
function IcoCalendar({ size = 13 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>; }
function IcoUsers({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function IcoCheck({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>; }
function IcoDrag({ size = 14 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" opacity={0.4}><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>; }

/* ─── Small reusable UI ─── */
function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: cfg.soft, color: cfg.color, letterSpacing: ".03em" }}><span style={{ width: 5, height: 5, borderRadius: 999, background: cfg.color }} />{cfg.label}</span>;
}

function MemberAvatar({ member, size = 26 }: { member: KanbanMember; size?: number }) {
  return <div title={member.name} style={{ width: size, height: size, borderRadius: 999, background: member.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0, border: "2px solid var(--paper)", fontFamily: "Spline Sans Mono, monospace", letterSpacing: "-.02em" }}>{member.initials}</div>;
}

function LabelChip({ label }: { label: KanbanLabel }) {
  return <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700, background: label.color + "22", color: label.color, letterSpacing: ".03em" }}>{label.name}</span>;
}

/* ─── Card view ─── */
function CardContent({ card, members, labels, onEdit, onDelete, isDragging }: {
  card: KanbanCard; members: KanbanMember[]; labels: KanbanLabel[];
  onEdit?: (card: KanbanCard) => void; onDelete?: (id: string) => void; isDragging?: boolean;
}) {
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const cardMembers = members.filter((m) => card.assigneeIds.includes(m.id));
  const past = isPast(card.dueDate) && !isDragging;
  const dateColor = past ? "#c1567a" : "var(--muted)";
  return (
    <div style={{ background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 13px", cursor: isDragging ? "grabbing" : "grab", opacity: isDragging ? 0.4 : 1, boxShadow: isDragging ? "0 12px 32px rgba(33,30,25,.22)" : "0 1px 3px rgba(33,30,25,.07)", userSelect: "none" }}>
      {cardLabels.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>{cardLabels.map((l) => <LabelChip key={l.id} label={l} />)}</div>}
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: "var(--ink)", marginBottom: 9, wordBreak: "break-word" }}>{card.title}</div>
      <div style={{ marginBottom: 10 }}><PriorityBadge priority={card.priority} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {card.dueDate && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: dateColor, background: past ? "#f8e0e9" : "var(--panel)", padding: "2px 7px", borderRadius: 6 }}><IcoCalendar />{fmtDate(card.dueDate)}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {cardMembers.length > 0 && <div style={{ display: "flex", marginRight: 4 }}>{cardMembers.map((m, i) => <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}><MemberAvatar member={m} size={24} /></div>)}</div>}
          {!isDragging && onEdit && onDelete && (
            <div style={{ display: "flex", gap: 3 }}>
              <button onClick={(e) => { e.stopPropagation(); onEdit(card); }} title="Edit card" style={{ padding: "3px 5px", border: "1px solid var(--border)", background: "var(--panel)", borderRadius: 6, cursor: "pointer", color: "var(--muted)", display: "inline-flex" }}><IcoEdit /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(card.id); }} title="Delete card" style={{ padding: "3px 5px", border: "1px solid var(--border)", background: "var(--panel)", borderRadius: 6, cursor: "pointer", color: "#a8584a", display: "inline-flex" }}><IcoTrash /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sortable card wrapper ─── */
function SortableCard({ card, members, labels, onEdit, onDelete }: { card: KanbanCard; members: KanbanMember[]; labels: KanbanLabel[]; onEdit: (c: KanbanCard) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, data: { type: "card", card } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners}>
      <CardContent card={card} members={members} labels={labels} onEdit={onEdit} onDelete={onDelete} isDragging={isDragging} />
    </div>
  );
}

/* ─── Quick-add card ─── */
function QuickAddCard({ columnId, onAdd }: { columnId: string; onAdd: (title: string, columnId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  function commit() { const t = title.trim(); if (t) onAdd(t, columnId); setTitle(""); setOpen(false); }
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: "transparent", color: "var(--muted)", fontSize: 13.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", textAlign: "left" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(33,30,25,.06)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <IcoPlus size={15} /> Add a card
    </button>
  );
  return (
    <div style={{ padding: "2px 0" }}>
      <textarea ref={inputRef} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); } if (e.key === "Escape") { setOpen(false); setTitle(""); } }} placeholder="Card title…" style={{ width: "100%", minHeight: 64, resize: "vertical", fontSize: 13.5, borderRadius: 8, border: "1px solid var(--accent)", padding: "8px 10px", background: "var(--paper)", fontFamily: "Spline Sans, sans-serif" }} />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button onClick={commit} style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Add card</button>
        <button onClick={() => { setOpen(false); setTitle(""); }} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--borderStrong)", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center" }}><IcoX /></button>
      </div>
    </div>
  );
}

/* ─── Column menu ─── */
function ColumnMenu({ column, onEdit, onDelete }: { column: KanbanColumn; onEdit: (c: KanbanColumn) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }} style={{ padding: "3px 5px", borderRadius: 6, border: "none", background: "transparent", color: "rgba(255,255,255,.75)", cursor: "pointer", display: "inline-flex", alignItems: "center" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.18)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><IcoDots /></button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--paper)", border: "1px solid var(--borderStrong)", borderRadius: 10, minWidth: 150, boxShadow: "0 8px 24px rgba(33,30,25,.18)", zIndex: 100, overflow: "hidden" }}>
          <button onClick={() => { setOpen(false); onEdit(column); }} style={{ width: "100%", padding: "9px 14px", border: "none", background: "transparent", color: "var(--ink)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><IcoEdit /> Edit column</button>
          <div style={{ height: 1, background: "var(--border)", margin: "0 10px" }} />
          <button onClick={() => { setOpen(false); onDelete(column.id); }} style={{ width: "100%", padding: "9px 14px", border: "none", background: "transparent", color: "#a8584a", fontSize: 13.5, fontWeight: 500, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }} onMouseEnter={(e) => (e.currentTarget.style.background = "#fdf0ef")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><IcoTrash /> Delete column</button>
        </div>
      )}
    </div>
  );
}

/* ─── Sortable column ─── */
function SortableColumn({ column, cards, members, labels, memberFilter, onAddCard, onEditCard, onDeleteCard, onEditColumn, onDeleteColumn }: {
  column: KanbanColumn; cards: KanbanCard[]; members: KanbanMember[]; labels: KanbanLabel[]; memberFilter: string | null;
  onAddCard: (title: string, columnId: string) => void; onEditCard: (c: KanbanCard) => void; onDeleteCard: (id: string) => void;
  onEditColumn: (c: KanbanColumn) => void; onDeleteColumn: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id, data: { type: "column", column } });
  const visibleCards = memberFilter ? cards.filter((c) => c.assigneeIds.includes(memberFilter)) : cards;
  const cardIds = visibleCards.map((c) => c.id);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, flexShrink: 0, width: 280 }}>
      <div style={{ background: "var(--panel)", border: "1px solid var(--borderStrong)", borderRadius: 12, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 160px)", overflow: "hidden" }}>
        <div {...attributes} {...listeners} style={{ background: column.color, padding: "11px 13px", display: "flex", alignItems: "center", gap: 8, borderRadius: "11px 11px 0 0", cursor: isDragging ? "grabbing" : "grab" }}>
          <IcoDrag size={14} />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13.5, flex: 1, letterSpacing: ".01em" }}>{column.title}</span>
          <span style={{ background: "rgba(255,255,255,.22)", color: "#fff", borderRadius: 999, fontSize: 11.5, fontWeight: 700, padding: "1px 8px", minWidth: 24, textAlign: "center" }}>{visibleCards.length}</span>
          <ColumnMenu column={column} onEdit={onEditColumn} onDelete={onDeleteColumn} />
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 8px 4px", display: "flex", flexDirection: "column", gap: 6 }}>
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {visibleCards.map((card) => <SortableCard key={card.id} card={card} members={members} labels={labels} onEdit={onEditCard} onDelete={onDeleteCard} />)}
          </SortableContext>
          {visibleCards.length === 0 && <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--faint)", fontSize: 13, borderRadius: 8, border: "2px dashed var(--border)", margin: "4px 0" }}>Drop cards here</div>}
        </div>
        <div style={{ padding: "4px 8px 8px", borderTop: "1px solid var(--border)", marginTop: 2 }}>
          <QuickAddCard columnId={column.id} onAdd={onAddCard} />
        </div>
      </div>
    </div>
  );
}

/* ─── Shared label style ─── */
const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 5 };

/* ─── Card Detail Modal ─── */
function CardModal({ card, columns, members, labels, onSave, onClose }: { card: KanbanCard; columns: KanbanColumn[]; members: KanbanMember[]; labels: KanbanLabel[]; onSave: (c: KanbanCard) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ ...card });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof KanbanCard>(k: K, v: KanbanCard[K]) => setForm((f) => ({ ...f, [k]: v }));
  function toggleAssignee(id: string) { set("assigneeIds", form.assigneeIds.includes(id) ? form.assigneeIds.filter((x) => x !== id) : [...form.assigneeIds, id]); }
  function toggleLabel(id: string)    { set("labelIds",    form.labelIds.includes(id)    ? form.labelIds.filter((x) => x !== id)    : [...form.labelIds,    id]); }
  async function handleSave() { if (!form.title.trim()) return; setSaving(true); await onSave({ ...form, title: form.title.trim() }); setSaving(false); }
  const isNew = card.title === "";
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(33,30,25,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", zIndex: 60, overflowY: "auto" }}>
      <div style={{ background: "var(--bg)", borderRadius: 18, border: "1px solid var(--borderStrong)", width: "100%", maxWidth: 620, padding: "24px 28px", boxShadow: "0 24px 60px rgba(33,30,25,.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontFamily: "Fraunces,serif", fontSize: 22, fontWeight: 600, margin: 0 }}>{isNew ? "New Card" : "Edit Card"}</h2>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 9, border: "none", background: "transparent", color: "var(--muted)", display: "inline-flex", cursor: "pointer" }}><IcoX size={18} /></button>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={labelStyle}>Title</label><input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Card title…" autoFocus style={{ width: "100%" }} /></div>
            <div><label style={labelStyle}>Description</label><textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Add a more detailed description…" style={{ width: "100%", minHeight: 88, resize: "vertical", fontFamily: "Spline Sans, sans-serif" }} /></div>
            <div><label style={labelStyle}>Column</label><select value={form.columnId} onChange={(e) => set("columnId", e.target.value)} style={{ width: "100%" }}>{columns.map((col) => <option key={col.id} value={col.id}>{col.title}</option>)}</select></div>
          </div>
          <div style={{ width: 180, display: "flex", flexDirection: "column", gap: 16, flexShrink: 0 }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(["low","medium","high","urgent"] as Priority[]).map((p) => { const cfg = PRIORITY_CONFIG[p]; const active = form.priority === p; return <button key={p} onClick={() => set("priority", p)} style={{ padding: "5px 9px", borderRadius: 7, border: `1px solid ${active ? cfg.color : "var(--border)"}`, background: active ? cfg.soft : "var(--paper)", color: active ? cfg.color : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: cfg.color }} />{cfg.label}{active && <IcoCheck size={12} />}</button>; })}
              </div>
            </div>
            <div><label style={labelStyle}>Due date</label><input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} style={{ width: "100%", fontSize: 13 }} /></div>
            <div>
              <label style={labelStyle}>Assignees</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {members.map((m) => { const active = form.assigneeIds.includes(m.id); return <button key={m.id} onClick={() => toggleAssignee(m.id)} style={{ padding: "5px 8px", borderRadius: 7, border: `1px solid ${active ? m.color + "55" : "var(--border)"}`, background: active ? m.color + "18" : "var(--paper)", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}><MemberAvatar member={m} size={22} /><span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, textAlign: "left", color: active ? "var(--ink)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>{active && <IcoCheck size={12} />}</button>; })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Labels</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {labels.map((l) => { const active = form.labelIds.includes(l.id); return <button key={l.id} onClick={() => toggleLabel(l.id)} style={{ padding: "4px 9px", borderRadius: 7, border: `1px solid ${active ? l.color + "55" : "var(--border)"}`, background: active ? l.color + "18" : "var(--paper)", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} /><span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, textAlign: "left", color: active ? "var(--ink)" : "var(--muted)" }}>{l.name}</span>{active && <IcoCheck size={12} />}</button>; })}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid var(--borderStrong)", background: "var(--paper)", color: "var(--ink)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={!form.title.trim() || saving} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: form.title.trim() && !saving ? "var(--accent)" : "var(--borderStrong)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: form.title.trim() ? "pointer" : "default" }}>{saving ? "Saving…" : isNew ? "Add card" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Column modal ─── */
function ColumnModal({ column, onSave, onClose }: { column: KanbanColumn | null; onSave: (col: Omit<KanbanColumn, "order">) => Promise<void>; onClose: () => void }) {
  const isNew = !column;
  const [title, setTitle] = useState(column?.title ?? "");
  const [color, setColor] = useState(column?.color ?? COLUMN_COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  async function handleSave() { if (!title.trim()) return; setSaving(true); await onSave({ id: column?.id ?? uid(), title: title.trim(), color }); setSaving(false); }
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(33,30,25,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div style={{ background: "var(--bg)", borderRadius: 16, border: "1px solid var(--borderStrong)", width: "100%", maxWidth: 380, padding: "22px 24px", boxShadow: "0 24px 60px rgba(33,30,25,.28)" }}>
        <h2 style={{ fontFamily: "Fraunces,serif", fontSize: 20, fontWeight: 600, margin: "0 0 18px" }}>{isNew ? "Add column" : "Edit column"}</h2>
        <div style={{ marginBottom: 14 }}><label style={labelStyle}>Column name</label><input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose(); }} placeholder="e.g. In Review" autoFocus /></div>
        <div style={{ marginBottom: 20 }}><label style={labelStyle}>Color</label><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{COLUMN_COLOR_OPTIONS.map((c) => <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: color === c ? "3px solid var(--ink)" : "3px solid transparent", cursor: "pointer" }} />)}</div></div>
        <div style={{ background: color, color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13.5, fontWeight: 700, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,.5)" }} />{title || "Column name"}<span style={{ marginLeft: "auto", background: "rgba(255,255,255,.22)", borderRadius: 999, fontSize: 11, padding: "1px 8px" }}>0</span></div>
        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid var(--borderStrong)", background: "var(--paper)", color: "var(--ink)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || saving} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: title.trim() && !saving ? "var(--accent)" : "var(--borderStrong)", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: title.trim() ? "pointer" : "default" }}>{saving ? "Saving…" : isNew ? "Add column" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Members modal ─── */
function MembersModal({ members, onSave, onClose }: { members: KanbanMember[]; onSave: (m: KanbanMember[]) => Promise<void>; onClose: () => void }) {
  const [list, setList] = useState<KanbanMember[]>(members.map((m) => ({ ...m })));
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(MEMBER_COLOR_OPTIONS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  function addMember() { const name = newName.trim(); if (!name) return; setList((p) => [...p, { id: uid(), name, initials: toInitials(name), color: newColor }]); setNewName(""); setNewColor(MEMBER_COLOR_OPTIONS[0]); }
  function removeMember(id: string) { setList((p) => p.filter((m) => m.id !== id)); }
  function commitEdit(id: string) { const name = editName.trim(); if (name) setList((p) => p.map((m) => m.id === id ? { ...m, name, initials: toInitials(name) } : m)); setEditId(null); setEditName(""); }
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(33,30,25,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div style={{ background: "var(--bg)", borderRadius: 16, border: "1px solid var(--borderStrong)", width: "100%", maxWidth: 420, padding: "22px 24px", boxShadow: "0 24px 60px rgba(33,30,25,.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "Fraunces,serif", fontSize: 20, fontWeight: 600, margin: 0 }}>Team members</h2>
          <button onClick={onClose} style={{ padding: 7, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", display: "inline-flex" }}><IcoX /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {list.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 9, background: "var(--paper)", border: "1px solid var(--border)" }}>
              <MemberAvatar member={m} size={30} />
              {editId === m.id ? <input value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} onBlur={() => commitEdit(m.id)} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(m.id); if (e.key === "Escape") setEditId(null); }} style={{ flex: 1, fontSize: 13.5 }} /> : <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{m.name}</span>}
              <button onClick={() => { setEditId(m.id); setEditName(m.name); }} style={{ padding: "3px 5px", border: "1px solid var(--border)", background: "transparent", borderRadius: 6, cursor: "pointer", color: "var(--muted)", display: "inline-flex" }}><IcoEdit /></button>
              <button onClick={() => removeMember(m.id)} style={{ padding: "3px 5px", border: "1px solid var(--border)", background: "transparent", borderRadius: 6, cursor: "pointer", color: "#a8584a", display: "inline-flex" }}><IcoTrash /></button>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--panel)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border)", marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 10 }}>Add member</div>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMember(); }} placeholder="Full name" style={{ marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{MEMBER_COLOR_OPTIONS.map((c) => <button key={c} onClick={() => setNewColor(c)} style={{ width: 24, height: 24, borderRadius: 999, background: c, border: newColor === c ? "3px solid var(--ink)" : "3px solid transparent", cursor: "pointer" }} />)}</div>
          <button onClick={addMember} disabled={!newName.trim()} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: newName.trim() ? "var(--accent)" : "var(--borderStrong)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: newName.trim() ? "pointer" : "default" }}>Add member</button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid var(--borderStrong)", background: "var(--paper)", color: "var(--ink)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Cancel</button>
          <button onClick={async () => { setSaving(true); await onSave(list); setSaving(false); onClose(); }} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: saving ? "var(--borderStrong)" : "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main board ─── */
type ModalState = { type: "card"; card: KanbanCard } | { type: "column"; column: KanbanColumn | null } | { type: "members" } | null;

export default function KanbanPage() {
  const [state, setState] = useState<BoardState>({ columns: DEFAULT_COLUMNS, cards: [], members: DEFAULT_MEMBERS, labels: DEFAULT_LABELS });
  const [hydrated, setHydrated] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeColId, setActiveColId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [colsRes, cardsRes, membersRes] = await Promise.all([
        supabase.from("kanban_columns").select("*").order("ord"),
        supabase.from("kanban_cards").select("*").order("ord"),
        supabase.from("kanban_members").select("*"),
      ]);
      setState({
        columns: colsRes.data?.length ? colsRes.data.map(colFromRow) : DEFAULT_COLUMNS,
        cards:   cardsRes.data?.length ? cardsRes.data.map(cardFromRow) : [],
        members: membersRes.data?.length ? membersRes.data.map(memberFromRow) : DEFAULT_MEMBERS,
        labels:  DEFAULT_LABELS,
      });
      setHydrated(true);
    }
    load();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedColumns = useMemo(() => [...state.columns].sort((a, b) => a.order - b.order), [state.columns]);
  function cardsForColumn(colId: string) { return state.cards.filter((c) => c.columnId === colId).sort((a, b) => a.order - b.order); }

  const activeCard = activeCardId ? state.cards.find((c) => c.id === activeCardId) ?? null : null;
  const activeCol  = activeColId  ? state.columns.find((c) => c.id === activeColId) ?? null : null;

  /* ─── DnD handlers ─── */
  function onDragStart({ active }: DragStartEvent) {
    if (active.data.current?.type === "card")   setActiveCardId(active.id as string);
    if (active.data.current?.type === "column") setActiveColId(active.id as string);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    if (active.data.current?.type !== "card") return;
    const overId = over.id as string;
    const ac = state.cards.find((c) => c.id === active.id);
    if (!ac) return;
    const overCard = state.cards.find((c) => c.id === overId);
    const overCol  = state.columns.find((c) => c.id === overId);
    if (overCard && overCard.columnId !== ac.columnId) {
      setState((prev) => {
        const cards = [...prev.cards];
        const ai = cards.findIndex((c) => c.id === ac.id);
        const oi = cards.findIndex((c) => c.id === overId);
        cards[ai] = { ...cards[ai], columnId: overCard.columnId };
        return { ...prev, cards: arrayMove(cards, ai, oi) };
      });
    } else if (overCol && ac.columnId !== overId) {
      setState((prev) => ({ ...prev, cards: prev.cards.map((c) => c.id === ac.id ? { ...c, columnId: overId } : c) }));
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveCardId(null); setActiveColId(null);
    if (!over) return;

    if (active.data.current?.type === "card") {
      const overId = over.id as string;
      const overCard = state.cards.find((c) => c.id === overId);
      if (!overCard) return;
      setState((prev) => {
        const cards = [...prev.cards];
        const ai = cards.findIndex((c) => c.id === active.id);
        const oi = cards.findIndex((c) => c.id === overId);
        if (ai === oi) return prev;
        const moved = arrayMove(cards, ai, oi);
        const colGroups: Record<string, KanbanCard[]> = {};
        moved.forEach((c) => { if (!colGroups[c.columnId]) colGroups[c.columnId] = []; colGroups[c.columnId].push(c); });
        const reordered = moved.map((c) => ({ ...c, order: colGroups[c.columnId].indexOf(c) }));
        // Persist to Supabase asynchronously
        supabase.from("kanban_cards").upsert(reordered.map(cardToRow)).then();
        return { ...prev, cards: reordered };
      });
    }

    if (active.data.current?.type === "column") {
      setState((prev) => {
        const cols = [...prev.columns].sort((a, b) => a.order - b.order);
        const ai = cols.findIndex((c) => c.id === active.id);
        const oi = cols.findIndex((c) => c.id === over.id);
        if (ai === oi) return prev;
        const moved = arrayMove(cols, ai, oi).map((c, i) => ({ ...c, order: i }));
        supabase.from("kanban_columns").upsert(moved.map(colToRow)).then();
        return { ...prev, columns: moved };
      });
    }
  }

  /* ─── CRUD ─── */
  const addCard = useCallback(async (title: string, columnId: string) => {
    const colCards = state.cards.filter((c) => c.columnId === columnId);
    const card: KanbanCard = { id: uid(), title, description: "", columnId, assigneeIds: [], priority: "medium", dueDate: "", labelIds: [], order: colCards.length, createdAt: new Date().toISOString() };
    setState((prev) => ({ ...prev, cards: [...prev.cards, card] }));
    await supabase.from("kanban_cards").insert(cardToRow(card));
  }, [state.cards]);

  const saveCard = useCallback(async (card: KanbanCard) => {
    setState((prev) => {
      const exists = prev.cards.some((c) => c.id === card.id);
      return { ...prev, cards: exists ? prev.cards.map((c) => c.id === card.id ? card : c) : [...prev.cards, { ...card, order: prev.cards.filter((c) => c.columnId === card.columnId).length }] };
    });
    setModal(null);
    await supabase.from("kanban_cards").upsert(cardToRow(card));
  }, []);

  const deleteCard = useCallback(async (id: string) => {
    if (!confirm("Delete this card?")) return;
    setState((prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== id) }));
    await supabase.from("kanban_cards").delete().eq("id", id);
  }, []);

  const saveColumn = useCallback(async (col: Omit<KanbanColumn, "order">) => {
    const existing = state.columns.find((c) => c.id === col.id);
    const fullCol: KanbanColumn = existing ? { ...existing, ...col } : { ...col, order: state.columns.length };
    setState((prev) => {
      const exists = prev.columns.some((c) => c.id === col.id);
      return { ...prev, columns: exists ? prev.columns.map((c) => c.id === col.id ? fullCol : c) : [...prev.columns, fullCol] };
    });
    setModal(null);
    await supabase.from("kanban_columns").upsert(colToRow(fullCol));
  }, [state.columns]);

  const deleteColumn = useCallback(async (id: string) => {
    const col = state.columns.find((c) => c.id === id);
    const cardCount = state.cards.filter((c) => c.columnId === id).length;
    const msg = cardCount > 0 ? `Delete "${col?.title}" and its ${cardCount} card${cardCount > 1 ? "s" : ""}?` : `Delete "${col?.title}"?`;
    if (!confirm(msg)) return;
    setState((prev) => ({ ...prev, columns: prev.columns.filter((c) => c.id !== id), cards: prev.cards.filter((c) => c.columnId !== id) }));
    await supabase.from("kanban_columns").delete().eq("id", id); // cascade deletes cards
  }, [state.columns, state.cards]);

  const saveMembers = useCallback(async (members: KanbanMember[]) => {
    const oldIds = state.members.map((m) => m.id);
    const newIds = members.map((m) => m.id);
    const removed = oldIds.filter((id) => !newIds.includes(id));
    setState((prev) => ({ ...prev, members }));
    if (removed.length) await supabase.from("kanban_members").delete().in("id", removed);
    if (members.length) await supabase.from("kanban_members").upsert(members);
  }, [state.members]);

  if (!hydrated) return <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--muted)", fontSize: 14 }}>Loading from Supabase…</div>;

  const columnIds = sortedColumns.map((c) => c.id);

  return (
    <div style={{ minHeight: "calc(100vh - 50px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--border)", background: "rgba(244,240,232,.7)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", maxWidth: 1800, margin: "0 auto" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 3 }}>Kanban Board</div>
            <h1 style={{ fontFamily: "Fraunces,serif", fontSize: 28, fontWeight: 600, margin: 0, lineHeight: 1 }}>Team Board</h1>
          </div>
          {/* Member filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--muted)", marginRight: 2 }}>Filter:</span>
            <button onClick={() => setMemberFilter(null)} style={{ padding: "5px 12px", borderRadius: 999, border: `1px solid ${memberFilter === null ? "var(--accent)" : "var(--border)"}`, background: memberFilter === null ? "var(--accentSoft)" : "var(--paper)", color: memberFilter === null ? "var(--accent)" : "var(--muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>All</button>
            {state.members.map((m) => (
              <button key={m.id} onClick={() => setMemberFilter(memberFilter === m.id ? null : m.id)} title={m.name} style={{ padding: "3px 10px 3px 4px", borderRadius: 999, border: `1px solid ${memberFilter === m.id ? m.color : "var(--border)"}`, background: memberFilter === m.id ? m.color + "18" : "var(--paper)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MemberAvatar member={m} size={22} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: memberFilter === m.id ? "var(--ink)" : "var(--muted)" }}>{m.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setModal({ type: "members" })} style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid var(--borderStrong)", background: "var(--paper)", color: "var(--ink)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><IcoUsers size={15} /> Team</button>
            <button onClick={() => setModal({ type: "column", column: null })} style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><IcoPlus size={15} /> Add column</button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflowX: "auto", padding: "18px 24px 32px" }}>
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: "max-content" }}>
              {sortedColumns.map((col) => (
                <SortableColumn key={col.id} column={col} cards={cardsForColumn(col.id)} members={state.members} labels={state.labels} memberFilter={memberFilter}
                  onAddCard={addCard} onEditCard={(card) => setModal({ type: "card", card })} onDeleteCard={deleteCard}
                  onEditColumn={(column) => setModal({ type: "column", column })} onDeleteColumn={deleteColumn}
                />
              ))}
              <div style={{ flexShrink: 0, width: 280 }}>
                <button onClick={() => setModal({ type: "column", column: null })} style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px dashed var(--borderStrong)", background: "rgba(244,240,232,.6)", color: "var(--muted)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel)")} onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(244,240,232,.6)")}><IcoPlus /> Add another column</button>
              </div>
            </div>
          </SortableContext>
          <DragOverlay>
            {activeCard && <div style={{ width: 280, rotate: "2deg" }}><CardContent card={activeCard} members={state.members} labels={state.labels} isDragging /></div>}
            {activeCol  && <div style={{ width: 280, background: activeCol.color, borderRadius: 10, padding: "11px 13px", color: "#fff", fontWeight: 700, fontSize: 13.5, boxShadow: "0 12px 32px rgba(33,30,25,.28)", rotate: "-1deg" }}>{activeCol.title}</div>}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      {modal?.type === "card"    && <CardModal    card={modal.card} columns={state.columns} members={state.members} labels={state.labels} onSave={saveCard} onClose={() => setModal(null)} />}
      {modal?.type === "column"  && <ColumnModal  column={modal.column} onSave={saveColumn} onClose={() => setModal(null)} />}
      {modal?.type === "members" && <MembersModal members={state.members} onSave={saveMembers} onClose={() => setModal(null)} />}
    </div>
  );
}
