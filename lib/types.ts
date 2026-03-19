// lib/types.ts – shared types across the app

export type ReservationStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled' | 'completed'
export type PaymentMethod = 'card' | 'transfer' | 'cash'
export type ReservationSource = 'website' | 'airbnb' | 'booking' | 'phone' | 'email'

export interface Guest {
  id: string
  name: string
  email: string
  phone?: string
  country?: string
  notes?: string
  created_at: string
}

export interface Reservation {
  id: string
  guest_id?: string
  guest_name: string
  guest_email: string
  guest_phone?: string
  check_in: string     // ISO date: YYYY-MM-DD
  check_out: string
  nights: number
  adults: number
  children: number
  price_per_night: number
  total_price: number
  deposit_amount: number
  status: ReservationStatus
  payment_method?: PaymentMethod
  source: ReservationSource
  internal_notes?: string
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  reservation_id: string
  comgate_trans_id?: string
  amount: number
  currency: string
  status: 'pending' | 'paid' | 'cancelled' | 'authorized' | 'error'
  payment_url?: string
  paid_at?: string
  created_at: string
}

// Booking form data (from public website)
export interface BookingFormData {
  guest_name: string
  guest_email: string
  guest_phone?: string
  check_in: string
  check_out: string
  adults: number
  children: number
  message?: string
}
