'use client'
// app/admin/reservations/page.tsx
// Admin reservation management dashboard

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Reservation, ReservationStatus } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_LABELS: Record<ReservationStatus, { label: string; color: string }> = {
  pending:   { label: 'Čeká',      color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Potvrzena', color: 'bg-blue-100 text-blue-800' },
  paid:      { label: 'Zaplacena', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Zrušena',   color: 'bg-red-100 text-red-800' },
  completed: { label: 'Dokončena', color: 'bg-gray-100 text-gray-600' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatPrice(n: number) {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

const CLEANING_FEE = 2300
const CITY_TAX_PER_ADULT_PER_NIGHT = 50

function getTotalWithFees(r: Reservation): number {
  const cityTax = CITY_TAX_PER_ADULT_PER_NIGHT * r.adults * r.nights
  return r.total_price + CLEANING_FEE + cityTax
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ReservationStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Reservation | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('reservations').select('*').order('check_in', { ascending: true })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setReservations(data ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const filtered = reservations.filter(r =>
    !search || r.guest_name.toLowerCase().includes(search.toLowerCase()) ||
    r.guest_email.toLowerCase().includes(search.toLowerCase())
  )

  async function updateStatus(id: string, status: ReservationStatus) {
    setActionLoading(true)
    await supabase.from('reservations').update({ status }).eq('id', id)
    await load()
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
    setActionLoading(false)
  }

  async function sendPaymentLink(reservation: Reservation) {
    setActionLoading(true)
    const res = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId: reservation.id }),
    })
    const data = await res.json()
    if (data.paymentUrl) {
      alert(`Platební odkaz:\n${data.paymentUrl}\n\nOdkaz byl odeslán hostovi.`)
      // In production: send email with link
    } else {
      alert('Chyba: ' + data.error)
    }
    setActionLoading(false)
  }

  // Stats — počítá se pouze ze zaplacených rezervací (paid, completed)
  const paidReservations = reservations.filter(r => (['paid', 'completed'] as string[]).includes(r.status))
  const stats = {
    total: paidReservations.length,
    pending: reservations.filter(r => r.status === 'pending').length,
    paid: reservations.filter(r => r.status === 'paid').length,
    revenue: paidReservations.reduce((s, r) => s + getTotalWithFees(r), 0),
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800">Rezervace</h1>
          <p className="text-stone-500 mt-1">Správa všech rezervací Lipno Hideaway</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Potvrzeno', value: stats.total, color: 'bg-white' },
            { label: 'Čeká', value: stats.pending, color: 'bg-yellow-50', badge: stats.pending > 0 },
            { label: 'Zaplaceno', value: stats.paid, color: 'bg-green-50' },
            { label: 'Příjmy', value: formatPrice(stats.revenue), color: 'bg-blue-50' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-4 shadow-sm border border-stone-100`}>
              <div className="text-2xl font-bold text-stone-800">{s.value}</div>
              <div className="text-sm text-stone-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat hosta…"
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 w-48"
          />
          <div className="flex gap-2">
            {(['all', 'pending', 'confirmed', 'paid', 'cancelled', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === s ? 'bg-green-800 text-white' : 'bg-white text-stone-600 border border-stone-200 hover:border-green-800'
                }`}
              >
                {s === 'all' ? 'Vše' : STATUS_LABELS[s as ReservationStatus].label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-stone-400">Načítám…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-stone-400">Žádné rezervace</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-stone-500 uppercase tracking-wide bg-stone-50 border-b border-stone-100">
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Příjezd</th>
                  <th className="px-4 py-3">Odjezd</th>
                  <th className="px-4 py-3">Nocí</th>
                  <th className="px-4 py-3">Cena</th>
                  <th className="px-4 py-3">Stav</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    className="hover:bg-stone-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-stone-800">{r.guest_name}</div>
                      <div className="text-xs text-stone-500">{r.guest_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-700">{formatDate(r.check_in)}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">{formatDate(r.check_out)}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">{r.nights}</td>
                    <td className="px-4 py-3 text-sm font-medium text-stone-800">{formatPrice(getTotalWithFees(r))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_LABELS[r.status].color}`}>
                        {STATUS_LABELS[r.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-xs text-green-700 hover:underline"
                        onClick={e => { e.stopPropagation(); setSelected(r) }}
                      >
                        Detail →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-stone-800">{selected.guest_name}</h2>
                    <div className="text-sm text-stone-500">{selected.guest_email}</div>
                    {selected.guest_phone && <div className="text-sm text-stone-500">{selected.guest_phone}</div>}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-stone-400 hover:text-stone-600">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
                  <div className="bg-stone-50 rounded-lg p-3">
                    <div className="text-stone-500 text-xs mb-1">Příjezd</div>
                    <div className="font-medium">{formatDate(selected.check_in)}</div>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3">
                    <div className="text-stone-500 text-xs mb-1">Odjezd</div>
                    <div className="font-medium">{formatDate(selected.check_out)}</div>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3">
                    <div className="text-stone-500 text-xs mb-1">Osoby</div>
                    <div className="font-medium">{selected.adults} dospělí, {selected.children} děti</div>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3">
                    <div className="text-stone-500 text-xs mb-1">Nocí</div>
                    <div className="font-medium">{selected.nights}</div>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3 col-span-2">
                    <div className="text-stone-500 text-xs mb-2">Přehled ceny</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-stone-600">Ubytování ({selected.nights} nocí × {formatPrice(selected.price_per_night)})</span>
                        <span>{formatPrice(selected.total_price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">Závěrečný úklid</span>
                        <span>{formatPrice(CLEANING_FEE)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600">City tax ({selected.adults} os. × {selected.nights} nocí × {CITY_TAX_PER_ADULT_PER_NIGHT} Kč)</span>
                        <span>{formatPrice(CITY_TAX_PER_ADULT_PER_NIGHT * selected.adults * selected.nights)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-green-800 border-t border-stone-200 pt-1 mt-1">
                        <span>Celkem k úhradě</span>
                        <span>{formatPrice(getTotalWithFees(selected))}</span>
                      </div>
                      <div className="flex justify-between text-stone-500 text-xs pt-1">
                        <span>Záloha (30 %)</span>
                        <span>{formatPrice(selected.deposit_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selected.internal_notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4 text-sm text-stone-700">
                    <strong>Poznámka:</strong> {selected.internal_notes}
                  </div>
                )}

                {/* Status actions */}
                <div className="border-t border-stone-100 pt-4 space-y-2">
                  <div className="text-xs font-medium text-stone-500 mb-3 uppercase tracking-wide">Akce</div>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateStatus(selected.id, 'confirmed')}
                          disabled={actionLoading}
                          className="bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          ✓ Potvrdit
                        </button>
                        <button
                          onClick={() => sendPaymentLink(selected)}
                          disabled={actionLoading}
                          className="bg-green-800 text-white text-sm py-2 rounded-lg hover:bg-green-900 disabled:opacity-50"
                        >
                          💳 Zaslat platbu
                        </button>
                      </>
                    )}
                    {selected.status === 'confirmed' && (
                      <button
                        onClick={() => sendPaymentLink(selected)}
                        disabled={actionLoading}
                        className="bg-green-800 text-white text-sm py-2 rounded-lg col-span-2 hover:bg-green-900 disabled:opacity-50"
                      >
                        💳 Zaslat platební odkaz
                      </button>
                    )}
                    {selected.status !== 'cancelled' && selected.status !== 'completed' && (
                      <button
                        onClick={() => { if (confirm('Opravdu zrušit rezervaci?')) updateStatus(selected.id, 'cancelled') }}
                        disabled={actionLoading}
                        className="border border-red-200 text-red-600 text-sm py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 col-span-2"
                      >
                        Zrušit rezervaci
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
