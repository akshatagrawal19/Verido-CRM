import type { Lead, Stage, EnrichedLead } from "./types";

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function blank(): Lead {
  return {
    id: uid(),
    name: "",
    company: "",
    title: "",
    linkedinUrl: "",
    email: "",
    requestSent: false,
    requestSentDate: "",
    accepted: "pending",
    acceptedDate: "",
    followUpSent: false,
    followUpSentDate: "",
    response: "awaiting",
    notes: "",
    createdAt: new Date().toISOString(),
  };
}

export function stageOf(l: Lead): Stage {
  if (l.response && l.response !== "awaiting") return "responded";
  if (l.followUpSent) return "followup";
  if (l.accepted === "accepted") return "connected";
  if (l.accepted === "declined") return "declined";
  if (l.requestSent) return "sent";
  return "new";
}

export function enrich(leads: Lead[]): EnrichedLead[] {
  return leads.map((l) => ({ ...l, stage: stageOf(l) }));
}

export function fmt(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  } catch {
    return d;
  }
}

export function computeStats(leads: Lead[]) {
  return {
    total: leads.length,
    sent: leads.filter((l) => l.requestSent).length,
    accepted: leads.filter((l) => l.accepted === "accepted").length,
    followed: leads.filter((l) => l.followUpSent).length,
    responded: leads.filter((l) => l.response && l.response !== "awaiting").length,
    positive: leads.filter((l) => l.response === "positive").length,
  };
}
