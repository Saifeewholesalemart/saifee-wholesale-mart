import type { Order, Product, Retailer } from '@/lib/db';
import { isWalkInRetailerId } from '@/lib/db';

/** "Parle-G 100g (MRP ₹10)" — MRP is part of how the team identifies a product. */
export function productLabel(product?: Partial<Product> | null, fallback = 'Item'): string {
  const name = (product?.name || fallback).trim();
  const mrp = Number(product?.mrp) || 0;
  if (!mrp || /mrp|₹/i.test(name)) return name;
  return `${name} (MRP ₹${mrp % 1 === 0 ? mrp : mrp.toFixed(2)})`;
}

export function customerName(order: Order, retailers: Retailer[]): string {
  const r = retailers.find(x => x.id === order.retailer_id);
  if (r) return r.shop_name || r.owner_name || 'Customer';
  if (isWalkInRetailerId(order.retailer_id)) {
    const m = String(order.admin_notes || '').match(/Walk-in:\s*([^(|]+?)\s*\(/);
    return m?.[1]?.trim() ? `${m[1].trim()} (Walk-in)` : 'Counter / Walk-in';
  }
  return 'Customer';
}

export function formatINR(n: number): string {
  return '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
