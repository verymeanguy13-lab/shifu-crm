// Session 4: TypeScript Types — API request/response shapes
// Covers Customer, Property, Quote, Job, Payment CRUD payloads
// used by the API routes built starting Session 9.

import type {
  Customer,
  Property,
  Quote,
  QuoteLineItem,
  Job,
  Payment,
} from "./crm";

// ---------- Customers ----------

export interface CreateCustomerRequest {
  name: string;
  phone?: string;
  notes?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  notes?: string;
}

export interface CustomerResponse {
  customer: Customer;
}

export interface CustomerListResponse {
  customers: Customer[];
}

// ---------- Properties ----------

export interface CreatePropertyRequest {
  customer_id: number;
  address: string;
  access_notes?: string;
  billing_contact_id?: number;
}

export interface UpdatePropertyRequest {
  address?: string;
  access_notes?: string;
  billing_contact_id?: number;
}

export interface PropertyResponse {
  property: Property;
}

export interface PropertyListResponse {
  properties: Property[];
}

// ---------- Quotes ----------

export interface CreateQuoteRequest {
  customer_id: number;
  property_id?: number;
  lead_source?: string;
  line_items: {
    description: string;
    category: "labor" | "materials";
    qty: number;
    unit_price: number;
  }[];
  expires_at?: string;
}

export interface UpdateQuoteRequest {
  status?: Quote["status"];
  property_id?: number;
  lead_source?: string;
  expires_at?: string;
}

export interface QuoteResponse {
  quote: Quote;
  line_items: QuoteLineItem[];
}

export interface QuoteListResponse {
  quotes: Quote[];
}

// ---------- Jobs ----------

export interface CreateJobRequest {
  quote_id?: number;
  customer_id: number;
  property_id?: number;
  scheduled_at?: string;
  recurrence_rule?: string;
  assigned_to?: number;
}

export interface UpdateJobRequest {
  status?: Job["status"];
  scheduled_at?: string;
  warranty_until?: string;
  recurrence_rule?: string;
  assigned_to?: number;
}

export interface JobResponse {
  job: Job;
}

export interface JobListResponse {
  jobs: Job[];
}

// ---------- Payments ----------

export interface CreatePaymentRequest {
  job_id: number;
  amount: number;
  method?: string;
  transfer_reference?: string;
}

export interface UpdatePaymentRequest {
  status?: Payment["status"];
  paid_at?: string;
  transfer_reference?: string;
}

export interface PaymentResponse {
  payment: Payment;
}

export interface PaymentListResponse {
  payments: Payment[];
}

// ---------- Generic ----------

export interface ApiErrorResponse {
  error: string;
}
