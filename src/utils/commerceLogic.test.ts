import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOrderTotals,
  calculateDistanceKm,
  estimateDeliveryMinutes,
  getLoyaltyTier,
  canRedeemReward,
  getNextOrderStatus,
  getOrderProgressPercent,
  calculateAdminAnalytics,
} from './commerceLogic';

test('calculateOrderTotals computes subtotal, delivery fee, discount, and loyalty points accurately', () => {
  const lowCart = calculateOrderTotals([{ id: '1', name: 'Seda', price: 45, quantity: 2 }], 0);
  assert.equal(lowCart.subtotal, 90);
  assert.equal(lowCart.freeDeliveryUnlocked, false);
  assert.equal(lowCart.deliveryFee, 14.9);
  assert.equal(lowCart.total, 104.9);
  assert.equal(lowCart.loyaltyEarned, 157);

  const highCart = calculateOrderTotals([{ id: '2', name: 'Humidor', price: 200, quantity: 1 }], 25);
  assert.equal(highCart.subtotal, 200);
  assert.equal(highCart.freeDeliveryUnlocked, true);
  assert.equal(highCart.deliveryFee, 0);
  assert.equal(highCart.discount, 25);
  assert.equal(highCart.total, 175);
});

test('calculateDistanceKm and estimateDeliveryMinutes compute geolocation distance and ETA', () => {
  // Jardins to Vila Madalena in Sao Paulo (~3.5 km)
  const dist = calculateDistanceKm(-23.564, -46.668, -23.551, -46.691);
  assert.ok(dist >= 2.5 && dist <= 4.0);
  const eta = estimateDeliveryMinutes(dist, 12);
  assert.ok(eta >= 22 && eta <= 32);
});

test('getLoyaltyTier and canRedeemReward handle gamified progression correctly', () => {
  const bronze = getLoyaltyTier(120);
  assert.equal(bronze.tier, 'Bronze');
  assert.equal(bronze.nextTier, 'Prata');
  assert.equal(bronze.pointsToNext, 180);

  const gold = getLoyaltyTier(900);
  assert.equal(gold.tier, 'Ouro');
  assert.equal(gold.nextTier, 'Reserva Black');

  const black = getLoyaltyTier(1800);
  assert.equal(black.tier, 'Reserva Black');
  assert.equal(black.nextTier, null);
  assert.equal(black.progressPercent, 100);

  assert.equal(canRedeemReward(500, 350), true);
  assert.equal(canRedeemReward(200, 350), false);
});

test('getNextOrderStatus transitions order lifecycle deterministically', () => {
  assert.equal(getNextOrderStatus('confirmed'), 'preparing');
  assert.equal(getNextOrderStatus('preparing'), 'delivering');
  assert.equal(getNextOrderStatus('delivering'), 'delivered');
  assert.equal(getNextOrderStatus('delivered'), 'delivered');
  assert.equal(getOrderProgressPercent('delivering'), 85);
  assert.equal(getOrderProgressPercent('delivered'), 100);
});

test('calculateAdminAnalytics aggregates partner store KPIs', () => {
  const summary = calculateAdminAnalytics([
    { orderId: 'o1', totalAmount: 150, status: 'delivered', storeId: 's1' },
    { orderId: 'o2', totalAmount: 250, status: 'delivering', storeId: 's1' },
    { orderId: 'o3', totalAmount: 90, status: 'cancelled', storeId: 's1' },
  ]);
  assert.equal(summary.totalRevenue, 400);
  assert.equal(summary.averageTicket, 200);
  assert.equal(summary.activeOrdersCount, 1);
  assert.equal(summary.completedOrdersCount, 1);
});
