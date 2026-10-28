export type Role = 'customer' | 'servmate' | 'admin';

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  since: string;
  role: Role;
  photo: string;
  verified: boolean;
  /** Set by staff decisions only; owners cannot change it. */
  status?: 'active' | 'suspended';
  bio?: string;
}

export interface ServMate {
  id: string;
  uid: string;
  name: string;
  photo: string;
  rating: number;
  reviews: number;
  jobs: number;
  rate: number;
  distance: string;
  area: string;
  skills: string[];
  availability: string;
  verified: boolean;
  bio: string;
  responseTime: string;
  repeat: number;
  cover: string;
  status: 'active' | 'pending' | 'suspended';
}

export interface Service {
  id: string;
  name: string;
  category: string;
  providerId: string;
  provider: string;
  rate: number;
  minHours: number;
  rating: number;
  reviews: number;
  distance: string;
  image: string;
  blurb: string;
  description: string;
  tags: string[];
  availability: string;
  status: 'live' | 'review' | 'paused' | 'rejected';
  area: string;
}

/** `BOOKING_STATUSES` in functions/src/bookings.ts — the server owns this lifecycle. */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'requested'
  | 'accepted'
  | 'blocked'
  | 'rescheduled';

export interface Booking {
  id: string;
  serviceId: string;
  service: string;
  providerId: string;
  provider: string;
  providerPhoto: string;
  customerId: string;
  customer: string;
  date: string;
  time: string;
  hours: number;
  status: BookingStatus;
  address: string;
  notes: string;
  rate: number;
  fee: number;
  total: number;
  createdAt: string;
  photo: string;
}

export interface Message {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
}

export interface Thread {
  id: string;
  name: string;
  photo: string;
  role: string;
  updated: string;
  unread: number;
  messages: Message[];
}

export interface Review {
  id: string;
  author: string;
  photo: string;
  rating: number;
  text: string;
  date: string;
  service: string;
  target: string;
  flagged?: boolean;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  kind: 'booking' | 'message' | 'system' | 'payout';
  read: boolean;
}

export interface SavedPlace {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  city: string;
  since: string;
  /** Only present when the account document actually stores them. */
  bookings?: number;
  spend?: number;
  status: 'active' | 'suspended';
}

export interface AdminServMate {
  id: string;
  name: string;
  email: string;
  city: string;
  skills: string;
  rating: number;
  jobs: number;
  status: 'verified' | 'pending' | 'suspended';
}

export interface VerificationRequest {
  id: string;
  name: string;
  submitted: string;
  docs: number;
  status: 'pending' | 'approved' | 'rejected';
  type: string;
}

export interface Payment {
  id: string;
  customer: string;
  provider: string;
  service: string;
  amount: number;
  fee: number;
  status: 'paid' | 'pending' | 'refunded' | 'review' | 'rejected';
  method: string;
  date: string;
}

export interface Payout {
  id: string;
  provider: string;
  amount: number;
  status: 'paid' | 'scheduled' | 'review' | 'rejected';
  method: string;
  date: string;
}

export interface Dispute {
  id: string;
  booking: string;
  openedBy: string;
  priority: 'high' | 'normal' | 'low';
  sla: string;
  status: 'open' | 'waiting' | 'resolved' | 'rejected';
  summary: string;
}

export interface Ticket {
  id: string;
  subject: string;
  from: string;
  priority: 'high' | 'normal' | 'low';
  sla: string;
  status: 'open' | 'waiting' | 'resolved' | 'rejected';
  date: string;
}

export interface AuditEntry {
  id: string;
  time: string;
  actor: string;
  action: string;
  detail: string;
}

export interface AdminReview {
  id: string;
  service: string;
  from: string;
  to: string;
  rating: number;
  status: 'published' | 'flagged' | 'removed';
  date: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  scope: string;
  status: 'active' | 'invited' | 'disabled';
}

export interface DashStats {
  bookings: number;
  serviceValue: number;
  feeRevenue: number;
  completion: number;
}
