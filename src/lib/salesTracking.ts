'use client';

/**
 * Salesman location sharing (PWA, duty time only).
 *
 * - Salesman presses "Start Duty" (after agreeing once) -> the phone's location is sent
 *   every few minutes while the app is open, and on every order.
 * - "End Duty" stops it. A duty older than 14 hours ends by itself.
 * - Points are queued on the phone when there is no internet and sent later.
 *
 * Browsers only give location while the app is open; this is a known limit of PWAs.
 */

import { useEffect, useSyncExternalStore } from 'react';

type Kind = 'ping' | 'duty_start' | 'duty_end' | 'order' | 'consent';

interface Point {
  kind: Kind;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  battery?: number | null;
  ref_id?: string | null;
  ref_label?: string | null;
  recorded_at: string;
}

export interface TrackingState {
  userId: string | null;
  consent: boolean;
  onDuty: boolean;
  dutyStartedAt: string | null;
  lastSentAt: string | null;
  lastFixAt: string | null;
  queued: number;
  error: string;
  supported: boolean;
}

const PING_EVERY_MS = 3 * 60 * 1000;      // send at least every 3 minutes
const MOVE_TRIGGER_M = 150;                // or sooner when moved 150 m
const MIN_GAP_MS = 45 * 1000;              // never more often than every 45 s
const MAX_DUTY_MS = 14 * 3600 * 1000;      // forgotten duty ends by itself
const MAX_QUEUE = 2000;

const k = (name: string, userId: string) => `sgs_track_${name}_v1_${userId}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------------------------------------------------------------------------
// Singleton tracker
// ---------------------------------------------------------------------------

let state: TrackingState = {
  userId: null, consent: false, onDuty: false, dutyStartedAt: null,
  lastSentAt: null, lastFixAt: null, queued: 0, error: '',
  supported: typeof navigator !== 'undefined' && !!navigator.geolocation
};
const listeners = new Set<() => void>();
function setState(patch: Partial<TrackingState>) {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

let watchId: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let lastFix: { lat: number; lng: number; accuracy: number; at: number } | null = null;
let lastSent: { lat: number; lng: number; at: number } | null = null;
let flushing = false;
let batteryPct: number | null = null;

async function readBattery() {
  try {
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      const b = await nav.getBattery();
      batteryPct = Math.round((b.level || 0) * 100);
    }
  } catch { /* not supported */ }
}

function queue(): Point[] {
  return state.userId ? readJson<Point[]>(k('queue', state.userId), []) : [];
}
function saveQueue(q: Point[]) {
  if (!state.userId) return;
  const trimmed = q.length > MAX_QUEUE ? q.slice(q.length - MAX_QUEUE) : q;
  writeJson(k('queue', state.userId), trimmed);
  setState({ queued: trimmed.length });
}

function push(p: Point) {
  saveQueue([...queue(), p]);
  void flush();
}

export async function flush(): Promise<void> {
  if (flushing || !state.userId) return;
  const q = queue();
  if (q.length === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    const batch = q.slice(0, 100);
    const res = await fetch('/api/tracking/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ points: batch })
    });
    if (res.ok) {
      const rest = queue().slice(batch.length);
      saveQueue(rest);
      setState({ lastSentAt: new Date().toISOString(), error: '' });
      if (rest.length > 0) setTimeout(() => void flush(), 500);
    } else if (res.status === 401 || res.status === 403) {
      setState({ error: 'Location could not be sent. Please log in again.' });
    } else {
      setState({ error: 'Location saved on this phone. It will be sent when the server is reachable.' });
    }
  } catch {
    // offline: keep the queue, try again later
  } finally {
    flushing = false;
  }
}

function pointFromFix(kind: Kind, extra: Partial<Point> = {}): Point {
  return {
    kind,
    lat: lastFix ? lastFix.lat : null,
    lng: lastFix ? lastFix.lng : null,
    accuracy: lastFix ? Math.round(lastFix.accuracy) : null,
    battery: batteryPct,
    recorded_at: new Date().toISOString(),
    ...extra
  };
}

function maybePing(force = false) {
  if (!state.onDuty || !lastFix) return;
  const now = Date.now();
  if (lastSent && now - lastSent.at < MIN_GAP_MS) return;
  const moved = lastSent ? distanceM(lastSent, lastFix) : Infinity;
  if (force || !lastSent || now - lastSent.at >= PING_EVERY_MS || moved >= MOVE_TRIGGER_M) {
    lastSent = { lat: lastFix.lat, lng: lastFix.lng, at: now };
    push(pointFromFix('ping'));
  }
}

function onPosition(pos: GeolocationPosition) {
  lastFix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: Date.now() };
  setState({ lastFixAt: new Date().toISOString(), error: '' });
  maybePing();
}

function onPositionError(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) {
    setState({ error: 'Location permission is off. Allow location for this app in phone settings.' });
  } else if (err.code === err.POSITION_UNAVAILABLE) {
    setState({ error: 'Location not available. Turn on GPS / Location on the phone.' });
  }
}

function startWatching() {
  if (!state.supported || watchId !== null) return;
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true, maximumAge: 30000, timeout: 60000
  });
  if (!timer) {
    timer = setInterval(() => {
      void readBattery();
      if (state.dutyStartedAt && Date.now() - Date.parse(state.dutyStartedAt) > MAX_DUTY_MS) {
        void endDuty(true);
        return;
      }
      maybePing();
      void flush();
    }, 60 * 1000);
  }
}

function stopWatching() {
  if (watchId !== null && state.supported) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (timer) clearInterval(timer);
  timer = null;
}

/** One fresh position (or the last known one) within a few seconds. */
function currentFix(timeoutMs = 8000): Promise<void> {
  return new Promise(resolve => {
    if (!state.supported) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    navigator.geolocation.getCurrentPosition(
      pos => { onPosition(pos); finish(); },
      err => { onPositionError(err); finish(); },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: timeoutMs }
    );
    setTimeout(finish, timeoutMs + 500);
  });
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

/** Load this salesman's saved state (and resume an open duty after a reload). */
export function initTracking(userId: string | null | undefined) {
  if (!userId || typeof window === 'undefined') return;
  if (state.userId === userId) return;
  stopWatching();
  lastFix = null;
  lastSent = null;
  const duty = readJson<{ onDuty: boolean; startedAt: string | null }>(k('duty', userId), { onDuty: false, startedAt: null });
  const consent = readJson<boolean>(k('consent', userId), false);
  const stale = duty.onDuty && duty.startedAt && Date.now() - Date.parse(duty.startedAt) > MAX_DUTY_MS;
  setState({
    userId,
    consent,
    onDuty: duty.onDuty && !stale,
    dutyStartedAt: duty.onDuty && !stale ? duty.startedAt : null,
    queued: readJson<Point[]>(k('queue', userId), []).length,
    error: ''
  });
  if (stale) {
    writeJson(k('duty', userId), { onDuty: false, startedAt: null });
    push({ kind: 'duty_end', recorded_at: new Date(Date.parse(duty.startedAt!) + MAX_DUTY_MS).toISOString(), ref_label: 'Auto end after 14 hours' });
  }
  void readBattery();
  if (state.onDuty) startWatching();
  void flush();
}

export function giveConsent() {
  if (!state.userId) return;
  writeJson(k('consent', state.userId), true);
  setState({ consent: true });
  push({ kind: 'consent', recorded_at: new Date().toISOString(), ref_label: 'Agreed to location sharing during duty' });
}

export async function startDuty(): Promise<void> {
  if (!state.userId || !state.consent || state.onDuty) return;
  if (!state.supported) {
    setState({ error: 'This phone/browser does not support location.' });
    return;
  }
  const startedAt = new Date().toISOString();
  writeJson(k('duty', state.userId), { onDuty: true, startedAt });
  setState({ onDuty: true, dutyStartedAt: startedAt });
  await readBattery();
  await currentFix();
  push(pointFromFix('duty_start'));
  if (lastFix) lastSent = { lat: lastFix.lat, lng: lastFix.lng, at: Date.now() };
  startWatching();
}

export async function endDuty(auto = false): Promise<void> {
  if (!state.userId || !state.onDuty) return;
  if (!auto) await currentFix(5000);
  push(pointFromFix('duty_end', auto ? { ref_label: 'Auto end after 14 hours' } : {}));
  writeJson(k('duty', state.userId), { onDuty: false, startedAt: null });
  setState({ onDuty: false, dutyStartedAt: null });
  stopWatching();
}

/** Saves where an order was taken (only if the salesman agreed to location sharing). */
export async function recordOrderLocation(orderId: string, label: string): Promise<void> {
  if (!state.userId || !state.consent) return;
  if (!lastFix || Date.now() - lastFix.at > 2 * 60 * 1000) await currentFix(6000);
  push(pointFromFix('order', { ref_id: orderId, ref_label: label }));
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useSalesTracking(userId: string | null | undefined): TrackingState {
  useEffect(() => { initTracking(userId); }, [userId]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (state.onDuty) { startWatching(); void currentFix().then(() => maybePing()); }
        void flush();
      }
    };
    const onOnline = () => void flush();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
    () => state
  );
}
