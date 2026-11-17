export type OrderStatus = 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';
export type LoyaltyTierName = 'Bronze' | 'Prata' | 'Ouro' | 'Reserva Black';

export interface CartCalculationItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderTotalsResult {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  loyaltyEarned: number;
  freeDeliveryUnlocked: boolean;
}

export const FREE_DELIVERY_THRESHOLD = 180;
export const BASE_DELIVERY_FEE = 14.9;

export function calculateOrderTotals(
  items: CartCalculationItem[],
  couponDiscountBrl = 0
): OrderTotalsResult {
  const subtotal = Number(
    items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2)
  );
  if (subtotal <= 0) {
    return {
      subtotal: 0,
      deliveryFee: 0,
      discount: 0,
      total: 0,
      loyaltyEarned: 0,
      freeDeliveryUnlocked: false,
    };
  }

  const freeDeliveryUnlocked = subtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryFee = freeDeliveryUnlocked ? 0 : BASE_DELIVERY_FEE;
  const discount = Math.min(subtotal, Math.max(0, Number(couponDiscountBrl.toFixed(2))));
  const total = Number(Math.max(1, subtotal + deliveryFee - discount).toFixed(2));
  // 1.5 points per BRL spent
  const loyaltyEarned = Math.max(5, Math.round(total * 1.5));

  return {
    subtotal,
    deliveryFee,
    discount,
    total,
    loyaltyEarned,
    freeDeliveryUnlocked,
  };
}

export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function estimateDeliveryMinutes(distanceKm: number, prepMinutes = 12): number {
  const travelMinutes = Math.round(Math.max(0.5, distanceKm) * 4.5);
  return Math.max(15, prepMinutes + travelMinutes);
}

export interface LoyaltyTierInfo {
  tier: LoyaltyTierName;
  nextTier: LoyaltyTierName | null;
  pointsToNext: number;
  progressPercent: number;
  cashbackMultiplier: number;
}

export function getLoyaltyTier(points: number): LoyaltyTierInfo {
  const safePoints = Math.max(0, Math.floor(points));
  if (safePoints >= 1500) {
    return {
      tier: 'Reserva Black',
      nextTier: null,
      pointsToNext: 0,
      progressPercent: 100,
      cashbackMultiplier: 2.0,
    };
  }
  if (safePoints >= 750) {
    const progressPercent = Math.min(100, Math.round(((safePoints - 750) / 750) * 100));
    return {
      tier: 'Ouro',
      nextTier: 'Reserva Black',
      pointsToNext: 1500 - safePoints,
      progressPercent,
      cashbackMultiplier: 1.5,
    };
  }
  if (safePoints >= 300) {
    const progressPercent = Math.min(100, Math.round(((safePoints - 300) / 450) * 100));
    return {
      tier: 'Prata',
      nextTier: 'Ouro',
      pointsToNext: 750 - safePoints,
      progressPercent,
      cashbackMultiplier: 1.25,
    };
  }
  const progressPercent = Math.min(100, Math.round((safePoints / 300) * 100));
  return {
    tier: 'Bronze',
    nextTier: 'Prata',
    pointsToNext: 300 - safePoints,
    progressPercent,
    cashbackMultiplier: 1.0,
  };
}

export function canRedeemReward(currentPoints: number, rewardCost: number): boolean {
  return currentPoints >= rewardCost && rewardCost > 0;
}

export function getNextOrderStatus(current: OrderStatus): OrderStatus {
  switch (current) {
    case 'confirmed':
      return 'preparing';
    case 'preparing':
      return 'delivering';
    case 'delivering':
      return 'delivered';
    case 'delivered':
    case 'cancelled':
      return current;
  }
}

export function getOrderProgressPercent(status: OrderStatus): number {
  switch (status) {
    case 'confirmed':
      return 25;
    case 'preparing':
      return 55;
    case 'delivering':
      return 85;
    case 'delivered':
      return 100;
    case 'cancelled':
      return 0;
  }
}

export interface AdminOrderRecord {
  orderId: string;
  totalAmount: number;
  status: OrderStatus;
  storeId: string;
}

export interface AdminAnalyticsSummary {
  totalRevenue: number;
  averageTicket: number;
  activeOrdersCount: number;
  completedOrdersCount: number;
  completionRatePercent: number;
}

export function calculateAdminAnalytics(orders: AdminOrderRecord[]): AdminAnalyticsSummary {
  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalRevenue = Number(
    validOrders.reduce((sum, o) => sum + o.totalAmount, 0).toFixed(2)
  );
  const averageTicket =
    validOrders.length > 0 ? Number((totalRevenue / validOrders.length).toFixed(2)) : 0;
  const activeOrdersCount = orders.filter((o) =>
    ['confirmed', 'preparing', 'delivering'].includes(o.status)
  ).length;
  const completedOrdersCount = orders.filter((o) => o.status === 'delivered').length;
  const completionRatePercent =
    orders.length > 0 ? Math.round((completedOrdersCount / orders.length) * 100) : 100;

  return {
    totalRevenue,
    averageTicket,
    activeOrdersCount,
    completedOrdersCount,
    completionRatePercent,
  };
}
