export interface Lead {
  id: string;
  name: string;
  company: string;
  title: string;
  linkedinUrl: string;
  email: string;
  requestSent: boolean;
  requestSentDate: string;
  accepted: "pending" | "accepted" | "declined";
  acceptedDate: string;
  followUpSent: boolean;
  followUpSentDate: string;
  response: "awaiting" | "positive" | "neutral" | "negative";
  notes: string;
  createdAt: string;
}

export type Stage = "new" | "sent" | "connected" | "declined" | "followup" | "responded";

export interface EnrichedLead extends Lead {
  stage: Stage;
}

export interface StageConfig {
  key: string;
  label: string;
  color: string;
  soft: string;
}

export interface ResponseConfig {
  label: string;
  color: string;
  soft: string;
}
