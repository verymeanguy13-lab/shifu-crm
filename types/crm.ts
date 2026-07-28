// Session 4: TypeScript Types — one interface per table from db/schema.sql

export interface Business {
  id: number;
  name: string;
  phone: string | null;
  statement_number: string | null;
  line_channel_token: string | null;
  line_channel_secret: string | null;
  trade_types: string[];
  service_area: string | null;
  plan: "free" | "pro";
  created_at: string;
}

export interface Customer {
  id: number;
  business_id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface Property {
  id: number;
  customer_id: number;
  address: string;
  access_notes: string | null;
  billing_contact_id: number | null;
}

export interface ServiceTemplate {
  id: number;
  business_id: number;
  trade_type: string;
  name: string;
  default_price: number;
  unit: string | null;
  category: string | null;
  default_duration_minutes: number | null;
  default_warranty_months: number | null;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "expired" | "declined";

export interface Quote {
  id: number;
  business_id: number;
  customer_id: number;
  property_id: number | null;
  status: QuoteStatus;
  lead_source: string | null;
  total: number;
  accept_token: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface QuoteLineItem {
  id: number;
  quote_id: number;
  description: string;
  category: "labor" | "materials" | null;
  qty: number;
  unit_price: number;
}

export type JobStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export interface Job {
  id: number;
  quote_id: number | null;
  business_id: number;
  customer_id: number;
  property_id: number | null;
  status: JobStatus;
  scheduled_at: string | null;
  warranty_until: string | null;
  recurrence_rule: string | null;
  assigned_to: number | null;
}

export interface JobPhoto {
  id: number;
  job_id: number;
  url: string;
  stage: "before" | "after";
  created_at: string;
}

export interface JobNote {
  id: number;
  job_id: number;
  note_text: string;
  created_at: string;
}

export type PaymentStatus = "pending" | "paid" | "failed";

export interface Payment {
  id: number;
  job_id: number;
  amount: number;
  method: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  transfer_reference: string | null;
}

export interface Message {
  id: number;
  customer_id: number;
  direction: "inbound" | "outbound";
  body: string | null;
  line_message_type: string | null;
  created_at: string;
}

export interface Review {
  id: number;
  job_id: number;
  rating: number | null;
  comment: string | null;
  review_token: string | null;
  created_at: string;
}

export type TeamMemberRole = "owner" | "helper";

export interface TeamMember {
  id: number;
  business_id: number;
  name: string;
  role: TeamMemberRole;
  line_user_id: string | null;
}

export interface Part {
  id: number;
  business_id: number;
  name: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
}
