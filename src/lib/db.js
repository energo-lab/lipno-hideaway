// src/lib/db.js — Data layer: Supabase when configured, demo data as fallback
// This allows the site to work immediately without any backend setup.
// Once you configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, it switches to real data.

import { supabase, isConnected, STORAGE_URL } from './supabase';

// ═══════════════════════════════════════════
// DEMO DATA (used when Supabase is not configured)
// ═══════════════════════════════════════════

const DEMO_GALLERY = [
  { id:1, file_name:'exterior-01.jpg', file_path:'', category:'exterior', sort_order:0, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop' },
  { id:2, file_name:'exterior-02.jpg', file_path:'', category:'exterior', sort_order:1, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop' },
  { id:3, file_name:'zahrada.jpg', file_path:'', category:'exterior', sort_order:2, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop' },
  { id:4, file_name:'obyvak.jpg', file_path:'', category:'interior', sort_order:3, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=600&fit=crop' },
  { id:5, file_name:'kuchyn.jpg', file_path:'', category:'interior', sort_order:4, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=600&fit=crop' },
  { id:6, file_name:'loznice.jpg', file_path:'', category:'interior', sort_order:5, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=800&h=600&fit=crop' },
  { id:7, file_name:'koupelna.jpg', file_path:'', category:'bathroom', sort_order:6, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&h=600&fit=crop' },
  { id:8, file_name:'terasa.jpg', file_path:'', category:'terrace', sort_order:7, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop' },
  { id:9, file_name:'jezero.jpg', file_path:'', category:'surroundings', sort_order:8, is_visible:true, is_hero:true, url:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop' },
  { id:10, file_name:'priroda.jpg', file_path:'', category:'surroundings', sort_order:9, is_visible:true, is_hero:false, url:'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=600&fit=crop' },
];

const DEMO_RESERVATIONS = [
  { id:1, guest_name:'Jan Novák', guest_email:'jan@example.com', guest_phone:'+420777111222', check_in:'2026-04-10', check_out:'2026-04-17', num_guests:6, total_price:55300, status:'confirmed', language:'cs', created_at:'2026-03-01' },
  { id:2, guest_name:'Thomas Weber', guest_email:'thomas@example.de', guest_phone:'+491721234567', check_in:'2026-04-25', check_out:'2026-04-30', num_guests:4, total_price:27500, status:'pending', language:'de', created_at:'2026-03-05' },
  { id:3, guest_name:'Pieter van Dijk', guest_email:'pieter@example.nl', guest_phone:'+31612345678', check_in:'2026-05-15', check_out:'2026-05-22', num_guests:8, total_price:45500, status:'confirmed', language:'nl', created_at:'2026-03-10' },
  { id:4, guest_name:'Eva Svobodová', guest_email:'eva@example.cz', guest_phone:'+420602333444', check_in:'2026-07-05', check_out:'2026-07-12', num_guests:9, total_price:90300, status:'pending', language:'cs', created_at:'2026-03-12' },
  { id:5, guest_name:'John Smith', guest_email:'john@example.com', guest_phone:'+447912345678', check_in:'2026-08-01', check_out:'2026-08-08', num_guests:5, total_price:90300, status:'confirmed', language:'en', created_at:'2026-03-14' },
];

const DEMO_REVIEWS = [
  { id:1, guest_name:'Petr & Klára', rating:5, review_text:'Úžasný dům s nádherným výhledem. Vybavení na nejvyšší úrovni, děti si užily zahradu.', language:'cs', approved:true, created_at:'2025-08-15' },
  { id:2, guest_name:'Hans & Greta M.', rating:5, review_text:'Perfekte Lage, Ruhe und Erholung. Das Haus ist sauber und modern. Sehr empfehlenswert!', language:'de', approved:true, created_at:'2025-07-20' },
  { id:3, guest_name:'Jan & Marie', rating:4, review_text:'Skvělá dovolená s rodinou. Blízko ski areálu i stezky korunami stromů.', language:'cs', approved:true, created_at:'2025-02-28' },
  { id:4, guest_name:'Familie de Vries', rating:5, review_text:'Beste accommodatie bij Lipno. Alles inbegrepen, geen verrassingskosten.', language:'nl', approved:true, created_at:'2025-08-22' },
];

// ═══════════════════════════════════════════
// DATABASE SERVICE
// ═══════════════════════════════════════════

export const db = {

  // ── GALLERY ──

  async getGalleryImages(category = null) {
    if (!isConnected()) {
      let imgs = DEMO_GALLERY.filter(i => i.is_visible);
      if (category && category !== 'all') imgs = imgs.filter(i => i.category === category);
      return imgs.sort((a,b) => a.sort_order - b.sort_order);
    }
    let q = supabase.from('gallery_images').select('*').eq('is_visible', true).order('sort_order');
    if (category && category !== 'all') q = q.eq('category', category);
    const { data } = await q;
    return (data || []).map(img => ({ ...img, url: STORAGE_URL + img.file_path }));
  },

  async getAllGalleryImages() {
    if (!isConnected()) return [...DEMO_GALLERY].sort((a,b) => a.sort_order - b.sort_order);
    const { data } = await supabase.from('gallery_images').select('*').order('sort_order');
    return (data || []).map(img => ({ ...img, url: STORAGE_URL + img.file_path }));
  },

  async uploadImage(file, category = 'interior') {
    if (!isConnected()) {
      // Demo mode: create local preview
      return { id: Date.now(), file_name: file.name, url: URL.createObjectURL(file), category, sort_order: 999, is_visible: true, is_hero: false, file_size: file.size };
    }
    const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from('gallery').upload(path, file, { cacheControl: '31536000' });
    if (upErr) throw upErr;
    const { data: mx } = await supabase.from('gallery_images').select('sort_order').order('sort_order', { ascending: false }).limit(1).single();
    const { data, error } = await supabase.from('gallery_images').insert({ file_name: file.name, file_path: path, file_size: file.size, category, alt_text: file.name, sort_order: (mx?.sort_order || 0) + 1, is_visible: true, is_hero: false }).select().single();
    if (error) { await supabase.storage.from('gallery').remove([path]); throw error; }
    return { ...data, url: STORAGE_URL + path };
  },

  async deleteImage(id, filePath) {
    if (!isConnected()) return;
    if (filePath) await supabase.storage.from('gallery').remove([filePath]);
    await supabase.from('gallery_images').delete().eq('id', id);
  },

  async updateImage(id, updates) {
    if (!isConnected()) return updates;
    const { data } = await supabase.from('gallery_images').update(updates).eq('id', id).select().single();
    return data;
  },

  async setHeroImage(id) {
    if (!isConnected()) return;
    await supabase.from('gallery_images').update({ is_hero: false }).eq('is_hero', true);
    await supabase.from('gallery_images').update({ is_hero: true }).eq('id', id);
  },

  async getHeroUrl() {
    if (!isConnected()) {
      const hero = DEMO_GALLERY.find(i => i.is_hero);
      return hero?.url || DEMO_GALLERY[0]?.url;
    }
    const { data } = await supabase.from('gallery_images').select('file_path').eq('is_hero', true).eq('is_visible', true).limit(1).single();
    if (data) return STORAGE_URL + data.file_path;
    const { data: fb } = await supabase.from('gallery_images').select('file_path').eq('is_visible', true).order('sort_order').limit(1).single();
    return fb ? STORAGE_URL + fb.file_path : null;
  },

  // ── RESERVATIONS ──

  async getReservations(status = null) {
    if (!isConnected()) {
      let r = [...DEMO_RESERVATIONS];
      if (status && status !== 'all') r = r.filter(x => x.status === status);
      return r;
    }
    let q = supabase.from('reservations').select('*').order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data } = await q;
    return data || [];
  },

  async createReservation(reservation) {
    if (!isConnected()) {
      console.log('DEMO: Reservation created', reservation);
      return { id: Date.now(), ...reservation, status: 'pending', created_at: new Date().toISOString() };
    }
    const { data, error } = await supabase.from('reservations').insert(reservation).select().single();
    if (error) throw error;
    // Trigger email notification via Edge Function
    try {
      await supabase.functions.invoke('send-email', { body: { type: 'new_reservation', reservation: data } });
    } catch (e) { console.warn('Email notification failed:', e); }
    return data;
  },

  async updateReservationStatus(id, status) {
    if (!isConnected()) return;
    const { data } = await supabase.from('reservations').update({ status }).eq('id', id).select().single();
    return data;
  },

  // ── REVIEWS ──

  async getApprovedReviews() {
    if (!isConnected()) return DEMO_REVIEWS.filter(r => r.approved);
    const { data } = await supabase.from('reviews').select('*').eq('approved', true).order('created_at', { ascending: false });
    return data || [];
  },

  async getAllReviews() {
    if (!isConnected()) return [...DEMO_REVIEWS];
    const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async updateReview(id, updates) {
    if (!isConnected()) return;
    await supabase.from('reviews').update(updates).eq('id', id);
  },

  async deleteReview(id) {
    if (!isConnected()) return;
    await supabase.from('reviews').delete().eq('id', id);
  },

  // ── AUTH (admin login) ──

  async signIn(email, password) {
    if (!isConnected()) {
      // Demo mode: any password works
      return { user: { email: 'admin@lipno20.cz' } };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (!isConnected()) return;
    await supabase.auth.signOut();
  },

  async getSession() {
    if (!isConnected()) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session;
  },
};
