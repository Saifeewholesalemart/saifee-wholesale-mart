'use client';

/**
 * Admin: Salesman Tracking
 * - Live: every salesman's last known location, duty state, battery, today's orders.
 * - Day view: one salesman's route for a chosen day, with the places where orders were taken.
 * Map: OpenStreetMap via Leaflet (loaded from CDN, no API key, free).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, RefreshCw, Battery, ShoppingBag, ChevronLeft, ExternalLink, Store } from 'lucide-react';
import { useDb } from '@/context/DbContext';

type Kind = 'ping' | 'duty_start' | 'duty_end' | 'order' | 'consent';
interface Point {
  user_id: string;
  kind: Kind;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  battery_pct: number | null;
  ref_id: string | null;
  ref_label: string | null;
  recorded_at: string;
}
interface Salesman {
  user_id: string;
  name: string;
  mobile: string;
  role: string;
  consent: boolean;
  on_duty: boolean;
  duty_started_at: string | null;
  last: Point | null;
  today_orders: number;
}

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const KHACHROD: [number, number] = [23.4226, 75.2817];
const LIVE_MINUTES = 15;

let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
    }
    if (!document.getElementById('shop-label-style')) {
      const st = document.createElement('style');
      st.id = 'shop-label-style';
      st.textContent = '.shop-label{background:rgba(255,255,255,.92);border:1px solid #bfdbfe;color:#1e3a8a;font-weight:700;font-size:11px;padding:1px 5px;box-shadow:none}.shop-label:before{display:none}';
      document.head.appendChild(st);
    }
    const js = document.createElement('script');
    js.src = LEAFLET_JS;
    js.async = true;
    js.onload = () => resolve((window as any).L);
    js.onerror = () => { leafletPromise = null; reject(new Error('Map could not load')); };
    document.head.appendChild(js);
  });
  return leafletPromise;
}

function todayIst(): string {
  return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
}
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}
function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function distanceKm(points: { lat: number; lng: number }[]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(s));
  }
  return total;
}
function esc(t: string): string {
  return t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
/** Opens this exact spot in Google Maps (app on phone, website on computer) — shows area and shop names. */
function gmapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
function gmapsLinkHtml(lat: number, lng: number): string {
  return `<a href="${gmapsUrl(lat, lng)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-weight:700;color:#3730a3;text-decoration:underline">Open in Google Maps</a>`;
}

interface ShopSpot {
  key: string;
  name: string;
  lat: number;
  lng: number;
  lastOrderAt: string;
  orders: number;
}

function isLive(s: Salesman): boolean {
  return s.on_duty && !!s.last && Date.now() - Date.parse(s.last.recorded_at) < LIVE_MINUTES * 60000;
}

export default function SalesmanTrackingPage() {
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [date, setDate] = useState(todayIst());
  const [dayPoints, setDayPoints] = useState<Point[] | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [mapError, setMapError] = useState('');
  const [orderPoints, setOrderPoints] = useState<Point[]>([]);
  const [showShops, setShowShops] = useState(true);
  const { orders, retailers } = useDb();

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const fittedOnce = useRef(false);

  // ---------------------------------------------------------------- data
  const loadShops = useCallback(async () => {
    try {
      const res = await fetch('/api/tracking?shops=1', { credentials: 'same-origin', cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) setOrderPoints(json.points || []);
    } catch { /* shops layer is optional */ }
  }, []);

  // Shop location = where its latest order was taken (best GPS accuracy wins when several are close in time)
  const shops = useMemo<ShopSpot[]>(() => {
    const orderById = new Map(orders.map(o => [o.id, o]));
    const retailerById = new Map(retailers.map(r => [r.id, r]));
    const byShop = new Map<string, ShopSpot>();
    orderPoints.forEach(p => {
      if (p.lat == null || p.lng == null) return;
      if ((p.accuracy_m ?? 0) > 150) return; // too rough to mark a shop
      const order = p.ref_id ? orderById.get(p.ref_id) : undefined;
      const retailer = order ? retailerById.get(order.retailer_id) : undefined;
      const labelName = (p.ref_label || '').split(' · ').slice(1).join(' · ').trim();
      const name = retailer?.shop_name || labelName;
      if (!name) return;
      const key = retailer?.id || `name:${name.toLowerCase()}`;
      const existing = byShop.get(key);
      if (!existing) {
        byShop.set(key, { key, name, lat: p.lat, lng: p.lng, lastOrderAt: p.recorded_at, orders: 1 });
      } else {
        existing.orders += 1; // points come newest first: keep the newest position
      }
    });
    return Array.from(byShop.values());
  }, [orderPoints, orders, retailers]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/tracking', { credentials: 'same-origin', cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not load locations.');
      setSalesmen(json.salesmen || []);
      setUpdatedAt(new Date().toISOString());
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load locations.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDay = useCallback(async (userId: string, d: string) => {
    setDayLoading(true);
    try {
      const res = await fetch(`/api/tracking?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(d)}`, { credentials: 'same-origin', cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Could not load the route.');
      setDayPoints(json.points || []);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load the route.');
      setDayPoints([]);
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadShops();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') { void loadSummary(); void loadShops(); }
    }, 60000);
    return () => clearInterval(id);
  }, [loadSummary, loadShops]);

  useEffect(() => {
    if (!selected) { setDayPoints(null); return; }
    void loadDay(selected, date);
    if (date !== todayIst()) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void loadDay(selected, date);
    }, 60000);
    return () => clearInterval(id);
  }, [selected, date, loadDay]);

  // ---------------------------------------------------------------- map
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !mapEl.current || mapRef.current) return;
      const map = L.map(mapEl.current, { zoomControl: true }).setView(KHACHROD, 12);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setMapError('');
      setSalesmen(s => [...s]); // redraw
    }).catch(() => setMapError('Map could not load. Check the internet connection. The list below still works.'));
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; layerRef.current = null; }
    };
  }, []);

  const selectedPerson = salesmen.find(s => s.user_id === selected) || null;

  const route = useMemo(() => {
    const pts = (dayPoints || []).filter(p => p.lat !== null && p.lng !== null) as (Point & { lat: number; lng: number })[];
    const moving = pts.filter(p => p.kind !== 'consent');
    const orders = pts.filter(p => p.kind === 'order');
    const allOrders = (dayPoints || []).filter(p => p.kind === 'order');
    const duty = (dayPoints || []).filter(p => p.kind === 'duty_start' || p.kind === 'duty_end');
    return {
      pts: moving,
      orders,
      allOrders,
      duty,
      km: distanceKm(moving.filter(p => (p.accuracy_m ?? 0) <= 200)),
      first: (dayPoints || [])[0]?.recorded_at || null,
      last: (dayPoints || [])[(dayPoints || []).length - 1]?.recorded_at || null
    };
  }, [dayPoints]);

  useEffect(() => {
    const L = (typeof window !== 'undefined' ? (window as any).L : null);
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const bounds: [number, number][] = [];

    if (showShops) {
      const labelAll = shops.length <= 60;
      shops.forEach(sh => {
        const m = L.circleMarker([sh.lat, sh.lng], { radius: 6, color: '#1e3a8a', weight: 2, fillColor: '#93c5fd', fillOpacity: 0.95 })
          .bindPopup(`<strong>${esc(sh.name)}</strong><br>Last order ${timeAgo(sh.lastOrderAt)} · ${sh.orders} order${sh.orders === 1 ? '' : 's'} (90 days)<br>${gmapsLinkHtml(sh.lat, sh.lng)}`);
        if (labelAll) m.bindTooltip(esc(sh.name), { permanent: true, direction: 'right', offset: [8, 0], className: 'shop-label' });
        else m.bindTooltip(esc(sh.name));
        m.addTo(layer);
      });
    }

    if (selected && dayPoints) {
      const line = route.pts.map(p => [p.lat, p.lng] as [number, number]);
      if (line.length > 1) L.polyline(line, { color: '#4338ca', weight: 4, opacity: 0.8 }).addTo(layer);
      route.pts.forEach(p => {
        bounds.push([p.lat, p.lng]);
        if (p.kind === 'ping') {
          L.circleMarker([p.lat, p.lng], { radius: 3, color: '#4338ca', weight: 1, fillOpacity: 0.7 })
            .bindPopup(`${clock(p.recorded_at)}${p.battery_pct != null ? ` · Battery ${p.battery_pct}%` : ''}<br>${gmapsLinkHtml(p.lat, p.lng)}`).addTo(layer);
        } else if (p.kind === 'order') {
          L.circleMarker([p.lat, p.lng], { radius: 9, color: '#15803d', weight: 2, fillColor: '#22c55e', fillOpacity: 0.9 })
            .bindPopup(`<strong>Order</strong> ${clock(p.recorded_at)}<br>${esc(p.ref_label || '')}<br>${gmapsLinkHtml(p.lat, p.lng)}`).addTo(layer);
        } else if (p.kind === 'duty_start' || p.kind === 'duty_end') {
          L.circleMarker([p.lat, p.lng], { radius: 8, color: '#0f172a', weight: 2, fillColor: p.kind === 'duty_start' ? '#fbbf24' : '#94a3b8', fillOpacity: 1 })
            .bindPopup(`${p.kind === 'duty_start' ? 'Duty started' : 'Duty ended'} ${clock(p.recorded_at)}<br>${gmapsLinkHtml(p.lat, p.lng)}`).addTo(layer);
        }
      });
    } else {
      salesmen.forEach(s => {
        if (!s.last || s.last.lat == null || s.last.lng == null) return;
        const live = isLive(s);
        bounds.push([s.last.lat, s.last.lng]);
        L.circleMarker([s.last.lat, s.last.lng], {
          radius: 10, color: live ? '#15803d' : '#64748b', weight: 2,
          fillColor: live ? '#22c55e' : '#cbd5e1', fillOpacity: 0.95
        })
          .bindTooltip(esc(s.name), { permanent: true, direction: 'top', offset: [0, -10] })
          .bindPopup(`<strong>${esc(s.name)}</strong><br>${live ? 'On duty' : 'Not live'} · ${timeAgo(s.last.recorded_at)}${s.last.battery_pct != null ? `<br>Battery ${s.last.battery_pct}%` : ''}<br>${gmapsLinkHtml(s.last.lat, s.last.lng)}`)
          .addTo(layer);
      });
    }

    if (bounds.length === 1) map.setView(bounds[0], 15);
    else if (bounds.length > 1 && (selected || !fittedOnce.current)) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    if (!selected && bounds.length > 0) fittedOnce.current = true;
  }, [salesmen, selected, dayPoints, route, shops, showShops]);

  // ---------------------------------------------------------------- UI
  const liveCount = salesmen.filter(isLive).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Salesman Tracking</h1>
          <p className="text-sm text-slate-600">
            Location is shared only while a salesman is on duty and the app is open. {liveCount} of {salesmen.length} live now.
          </p>
        </div>
        <button type="button" onClick={() => { void loadSummary(); if (selected) void loadDay(selected, date); }}
          className="min-h-11 px-4 rounded-lg border border-slate-300 bg-white text-sm font-bold flex items-center gap-2">
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <div role="alert" className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="flex flex-wrap gap-4 items-start">
        {/* List / day details */}
        <aside className="flex-[1_1_280px] max-w-md flex flex-col gap-2.5">
          {selectedPerson ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setSelected(null)} className="min-h-10 px-2 -ml-2 text-sm font-bold text-indigo-800 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" /> All salesmen
                </button>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">Day
                  <input type="date" value={date} max={todayIst()} onChange={e => setDate(e.target.value || todayIst())}
                    className="min-h-10 border border-slate-300 rounded-lg px-2 text-sm" />
                </label>
              </div>
              <div>
                <strong className="text-base text-slate-900 block">{selectedPerson.name}</strong>
                <span className="text-xs text-slate-600">{selectedPerson.mobile}{selectedPerson.consent ? '' : ' · Has not agreed to location sharing yet'}</span>
              </div>
              {dayLoading && !dayPoints ? (
                <p className="text-sm text-slate-600">Loading route…</p>
              ) : (dayPoints || []).length === 0 ? (
                <p className="text-sm text-slate-600">No location for this day. The salesman did not start duty, or the app was closed.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-black">{route.km.toFixed(1)}</div><div className="text-[11px] text-slate-600">km (approx.)</div></div>
                    <div className="bg-slate-50 rounded-lg p-2"><div className="text-lg font-black">{route.allOrders.length}</div><div className="text-[11px] text-slate-600">orders</div></div>
                    <div className="bg-slate-50 rounded-lg p-2"><div className="text-sm font-black">{route.first ? clock(route.first) : '-'}–{route.last ? clock(route.last) : '-'}</div><div className="text-[11px] text-slate-600">first – last</div></div>
                  </div>
                  <ol className="flex flex-col divide-y divide-slate-100 text-sm">
                    {(dayPoints || []).filter(p => p.kind !== 'ping' && p.kind !== 'consent').map((p, i) => (
                      <li key={`${p.recorded_at}-${i}`} className="py-2 flex gap-3">
                        <span className="font-mono text-xs text-slate-600 w-12 shrink-0 pt-0.5">{clock(p.recorded_at)}</span>
                        <span className="min-w-0">
                          <span className={`font-semibold ${p.kind === 'order' ? 'text-green-800' : 'text-slate-900'}`}>
                            {p.kind === 'order' ? 'Order' : p.kind === 'duty_start' ? 'Duty started' : 'Duty ended'}
                          </span>
                          {p.ref_label && <span className="block text-xs text-slate-600 break-words">{p.ref_label}</span>}
                          {p.lat == null ? (
                            <span className="block text-xs text-amber-800">Location not available at this time</span>
                          ) : p.lng != null && (
                            <a href={gmapsUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-800 underline min-h-7">
                              <ExternalLink className="w-3 h-3" aria-hidden="true" /> Google Maps
                            </a>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-slate-500">Blue line = route from location updates. Green dots = orders. Yellow = duty start, grey = duty end.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {loading && <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-600 text-sm">Loading…</div>}
              {!loading && salesmen.length === 0 && !error && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-600 text-sm">No salesman profiles found. Add them in Manage Profiles.</div>
              )}
              {salesmen.map(s => {
                const live = isLive(s);
                return (
                  <div key={s.user_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => { setSelected(s.user_id); setDate(todayIst()); }}
                    className="w-full text-left hover:bg-slate-50 p-3.5 flex flex-col gap-1">
                    <span className="flex justify-between gap-2 items-center">
                      <strong className="text-[15px] text-slate-900">{s.name}</strong>
                      <span className={`text-xs font-bold rounded px-2 py-0.5 ${live ? 'bg-green-100 text-green-800' : s.on_duty ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                        {live ? 'Live' : s.on_duty ? 'On duty · no recent update' : 'Off duty'}
                      </span>
                    </span>
                    <span className="text-sm text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5 items-center">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden="true" />{s.last ? timeAgo(s.last.recorded_at) : 'No location yet'}</span>
                      {s.last?.battery_pct != null && <span className="flex items-center gap-1"><Battery className="w-3.5 h-3.5" aria-hidden="true" />{s.last.battery_pct}%</span>}
                      <span className="flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />{s.today_orders} today</span>
                    </span>
                    {!s.consent && <span className="text-xs text-amber-800">Has not started duty in the app yet.</span>}
                  </button>
                  {s.last && s.last.lat != null && s.last.lng != null && (
                    <a href={gmapsUrl(s.last.lat, s.last.lng)} target="_blank" rel="noopener noreferrer"
                      className="min-h-10 px-3.5 border-t border-slate-100 text-sm font-semibold text-indigo-800 flex items-center gap-1.5 hover:bg-indigo-50">
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Open last location in Google Maps
                    </a>
                  )}
                  </div>
                );
              })}
              {updatedAt && <p className="text-xs text-slate-500">Updated {timeAgo(updatedAt)} · refreshes every minute</p>}
            </>
          )}
        </aside>

        {/* Map */}
        <section className="flex-[999_1_480px] min-w-0 bg-white border border-slate-200 rounded-xl overflow-hidden isolate">
          {mapError && <div className="px-4 py-2 text-sm text-amber-900 bg-amber-50">{mapError}</div>}
          <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer min-h-9">
              <input type="checkbox" checked={showShops} onChange={e => setShowShops(e.target.checked)} className="w-4 h-4" />
              <Store className="w-4 h-4 text-blue-800" aria-hidden="true" /> Show shops ({shops.length})
            </label>
            <span className="text-xs text-slate-500">Shop dots come from where orders were taken. Tap any dot for Google Maps.</span>
          </div>
          <div ref={mapEl} className="w-full h-[60vh] min-h-[360px] bg-slate-100" role="region" aria-label="Map of salesman locations" />
        </section>
      </div>
    </div>
  );
}
