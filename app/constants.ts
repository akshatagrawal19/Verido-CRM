import type { StageConfig, ResponseConfig } from "./types";

export const STAGES: Record<string, StageConfig> = {
  new:       { key: "new",       label: "New Lead",     color: "#8a8276", soft: "#eceae3" },
  sent:      { key: "sent",      label: "Request Sent", color: "#3f6cb0", soft: "#e2e9f4" },
  connected: { key: "connected", label: "Connected",    color: "#2f7d5b", soft: "#dcefe5" },
  declined:  { key: "declined",  label: "No Response",  color: "#a8584a", soft: "#f1e0dc" },
  followup:  { key: "followup",  label: "Followed Up",  color: "#bf8a2d", soft: "#f3e9d3" },
  responded: { key: "responded", label: "Responded",    color: "#b8431f", soft: "#f3ddd3" },
};

export const RESPONSE: Record<string, ResponseConfig> = {
  awaiting: { label: "Awaiting", color: "#9b9180", soft: "#ece9e1" },
  positive: { label: "Positive", color: "#2f7d5b", soft: "#dcefe5" },
  neutral:  { label: "Neutral",  color: "#bf8a2d", soft: "#f3e9d3" },
  negative: { label: "Negative", color: "#a8584a", soft: "#f1e0dc" },
};

export const STORAGE_KEY = "linkedin-crm-leads-v1";
