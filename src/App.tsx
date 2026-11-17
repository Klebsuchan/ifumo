/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  MapPin,
  ShieldCheck,
  Bell,
  Plus,
  Minus,
  Trash2,
  X,
  CreditCard,
  QrCode,
  Banknote,
  Radar,
  LogOut,
  Wifi,
  ChevronDown,
  ChevronRight,
  Home,
  FileText,
  User as UserIcon,
  Truck,
  Bike,
  RotateCcw,
  Navigation,
  Tag,
  CheckCircle2,
  Save,
  Phone,
  PlusCircle,
  Store,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  PARTNER_STORES,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_REVIEWS,
  INITIAL_SUPPORT_MESSAGES,
  LOYALTY_REWARDS,
  PartnerStore,
  ProductItem,
  OrderRecord,
  StoreReview,
  SupportChatMessage,
  LoyaltyReward,
  DeliveryPaymentMethod,
} from './data/mockCatalog';
import {
  calculateOrderTotals,
  calculateDistanceKm,
  estimateDeliveryMinutes,
  getLoyaltyTier,
  OrderStatus,
} from './utils/commerceLogic';
import { OfflineIndicator } from './pwa/PWAWidgets';
import { GeoMapSection } from './components/GeoMapSection';
import { LoyaltyAndReviewsSection } from './components/LoyaltyAndReviewsSection';
import { AdminAndSupportSection } from './components/AdminAndSupportSection';
import { PlaceRegistrationPayload } from './components/PlaceRegistrationModal';

type ActiveSection = 'home' | 'search' | 'orders' | 'profile';

interface PushNotificationToast {
  id: string;
  title: string;
  body: string;
  timestamp: string;
}

const REFERENCE_ASSET = '/assets/aistudio/image_dc88fa52.png';

const CATEGORY_CIRCLES: Array<{
  id: ProductItem['category'];
  label: string;
  viewBox: string;
}> = [
  {
    id: 'Cigarros',
    label: 'Cigarros',
    viewBox: '42 578 108 108',
  },
  {
    id: 'Tabaco',
    label: 'Tabaco',
    viewBox: '185 578 108 108',
  },
  {
    id: 'Charutos',
    label: 'Charutos',
    viewBox: '327 578 108 108',
  },
  {
    id: 'Seda',
    label: 'Seda',
    viewBox: '468 578 108 108',
  },
  {
    id: 'Isqueiros',
    label: 'Isqueiros',
    viewBox: '609 578 108 108',
  },
  {
    id: 'Vape',
    label: 'Vape',
    viewBox: '742 578 108 108',
  },
];

const QUICK_ADDRESSES = [
  { label: 'Av. Paulista, 1000', lat: -23.5649, lng: -46.652 },
  { label: 'Rua Augusta, 1500', lat: -23.5582, lng: -46.6601 },
  { label: 'Al. Lorena, 1420', lat: -23.5614, lng: -46.6658 },
  { label: 'Av. Faria Lima, 3477', lat: -23.5868, lng: -46.6822 },
];

function GoogleBadgeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-2 3l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1l-3.3 2.6C4.8 19.9 8.1 22 12 22z"
      />
      <path
        fill="#4A90E2"
        d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L3.1 7.4C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.1 2 4.8 4.1 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"
      />
    </svg>
  );
}

function ReferenceSprite({
  viewBox,
  className,
  label,
}: {
  viewBox: string;
  className?: string;
  label: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={label}
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <image
        href={REFERENCE_ASSET}
        x="0"
        y="0"
        width="864"
        height="1536"
        preserveAspectRatio="none"
      />
    </svg>
  );
}

export default function App() {
  // Navigation State (4 Bottom Tabs from image_dc88fa52.png: Início, Buscar, Pedidos, Perfil)
  const [activeSection, setActiveSection] = useState<ActiveSection>('home');
  const [profileSubTab, setProfileSubTab] = useState<'loyalty' | 'admin'>('admin');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [customAddressInput, setCustomAddressInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Auth & Saved User Profile State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(420);
  const [userPhone, setUserPhone] = useState<string>('(11) 99876-5432');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileSavedFeedback, setProfileSavedFeedback] = useState<string>('');

  // Catalog, Stores & Filters (Strictly Platform-Registered Establishments & Products)
  const [stores, setStores] = useState<PartnerStore[]>(() => {
    try {
      const raw = localStorage.getItem('ifumo_stores_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to empty
    }
    return PARTNER_STORES;
  });
  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const raw = localStorage.getItem('ifumo_products_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to empty
    }
    return INITIAL_PRODUCTS;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Geolocation State (Default matches image_dc88fa52.png: "Av. Paulista, 1000")
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: -23.5649,
    lng: -46.652,
  });
  const [userAddressLabel, setUserAddressLabel] = useState<string>('Av. Paulista, 1000');
  const [selectedMapStoreId, setSelectedMapStoreId] = useState<string>(
    PARTNER_STORES[0]?.id || ''
  );

  // Shopping Cart & Checkout State (Starts empty — only registered products can be added)
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('ifumo_cart_quantities');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // Fallback to empty
    }
    return {};
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [activeCoupon, setActiveCoupon] = useState<{
    code: string;
    discountBrl: number;
  } | null>(null);
  const [couponInput, setCouponInput] = useState<string>('');
  const [checkoutCustomerName, setCheckoutCustomerName] = useState<string>('Lucas Andrade');
  const [checkoutAddress, setCheckoutAddress] = useState<string>(
    'Av. Paulista, 1000 - Bela Vista, São Paulo'
  );
  const [paymentMethod, setPaymentMethod] =
    useState<DeliveryPaymentMethod>('pix_entrega');
  const [changeFor, setChangeFor] = useState<string>('Sem troco');
  const [isSearchingNetwork, setIsSearchingNetwork] = useState<boolean>(false);
  const [isProcessingStripe, setIsProcessingStripe] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string>('');

  // Orders, Reviews, Support & Real-Time Push Notifications
  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const raw = localStorage.getItem('ifumo_orders_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to empty
    }
    return INITIAL_ORDERS;
  });
  const [reviews, setReviews] = useState<StoreReview[]>(() => {
    try {
      const raw = localStorage.getItem('ifumo_reviews_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to empty
    }
    return INITIAL_REVIEWS;
  });
  const [supportMessages, setSupportMessages] = useState<SupportChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem('ifumo_support_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to empty
    }
    return INITIAL_SUPPORT_MESSAGES;
  });
  const [liveNotifications, setLiveNotifications] = useState<PushNotificationToast[]>([]);
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState<boolean>(false);

  // Listen for Google Maps Quota Exceeded Event
  useEffect(() => {
    const handleQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeSection]);

  // Persist & Restore Saved User Profile, Cart & Loyalty Points in LocalStorage
  useEffect(() => {
    try {
      const cachedPts = localStorage.getItem('ifumo_loyalty_pts');
      if (cachedPts) setLoyaltyPoints(Number(cachedPts));
      const savedProfileRaw = localStorage.getItem('ifumo_saved_user_profile');
      if (savedProfileRaw) {
        const parsed = JSON.parse(savedProfileRaw);
        if (parsed.displayName) setCheckoutCustomerName(parsed.displayName);
        if (parsed.defaultAddress) {
          setUserAddressLabel(parsed.defaultAddress);
          setCheckoutAddress(parsed.defaultAddress);
        }
        if (parsed.phone) setUserPhone(parsed.phone);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ifumo_loyalty_pts', String(loyaltyPoints));
    } catch {
      // Ignore storage errors
    }
  }, [loyaltyPoints]);

  useEffect(() => {
    try {
      localStorage.setItem('ifumo_cart_quantities', JSON.stringify(cartQuantities));
    } catch {
      // Ignore storage errors
    }
  }, [cartQuantities]);

  // Persist stores, products, orders, reviews & supportMessages in localStorage for Vercel resilience
  useEffect(() => {
    try {
      localStorage.setItem('ifumo_stores_v2', JSON.stringify(stores));
    } catch {
      // Ignore storage errors
    }
  }, [stores]);

  useEffect(() => {
    try {
      localStorage.setItem('ifumo_products_v2', JSON.stringify(products));
    } catch {
      // Ignore storage errors
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('ifumo_orders_v2', JSON.stringify(orders));
    } catch {
      // Ignore storage errors
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem('ifumo_reviews_v2', JSON.stringify(reviews));
    } catch {
      // Ignore storage errors
    }
  }, [reviews]);

  useEffect(() => {
    try {
      localStorage.setItem('ifumo_support_v2', JSON.stringify(supportMessages));
    } catch {
      // Ignore storage errors
    }
  }, [supportMessages]);

  // Hydrate Real Persisted State from Backend (/api/state) + Sync Serverless State + Subscribe to Real-Time SSE (/api/events)
  useEffect(() => {
    let isMounted = true;

    async function fetchInitialBackendState() {
      try {
        const res = await fetch('/api/state');
        if (!res.ok || !isMounted) return;
        const data = await res.json();

        if (Array.isArray(data.stores) && data.stores.length > 0) {
          setStores((prev) => {
            const merged = new Map(prev.map((s) => [s.id, s]));
            for (const s of data.stores) {
              merged.set(s.id, s);
            }
            return Array.from(merged.values());
          });
        }
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts((prev) => {
            const merged = new Map(prev.map((p) => [p.id, p]));
            for (const p of data.products) {
              merged.set(p.id, p);
            }
            return Array.from(merged.values());
          });
        }
        if (Array.isArray(data.orders) && data.orders.length > 0) {
          setOrders((prev) => {
            const merged = new Map(prev.map((o) => [o.orderId, o]));
            for (const o of data.orders) {
              merged.set(o.orderId, o);
            }
            return Array.from(merged.values());
          });
        }
        if (Array.isArray(data.reviews) && data.reviews.length > 0) {
          setReviews((prev) => {
            const merged = new Map(prev.map((r) => [r.reviewId, r]));
            for (const r of data.reviews) {
              merged.set(r.reviewId, r);
            }
            return Array.from(merged.values());
          });
        }
        if (Array.isArray(data.supportMessages) && data.supportMessages.length > 0) {
          setSupportMessages((prev) => {
            const merged = new Map(prev.map((m) => [m.messageId, m]));
            for (const m of data.supportMessages) {
              merged.set(m.messageId, m);
            }
            return Array.from(merged.values());
          });
        }
        if (Array.isArray(data.notifications) && data.notifications.length > 0) {
          setLiveNotifications(data.notifications);
        }
        const activeUid = auth.currentUser?.uid || 'demo_user_1';
        if (data.users && data.users[activeUid]) {
          const saved = data.users[activeUid];
          if (saved.displayName) setCheckoutCustomerName(saved.displayName);
          if (saved.defaultAddress) {
            setUserAddressLabel(saved.defaultAddress);
            setCheckoutAddress(saved.defaultAddress);
          }
          if (saved.phone) setUserPhone(saved.phone);
          if (typeof saved.loyaltyPoints === 'number') setLoyaltyPoints(saved.loyaltyPoints);
        }

        // Hydrate serverless container if client has persisted stores/products after a Vercel cold start
        try {
          const localStores = JSON.parse(localStorage.getItem('ifumo_stores_v2') || '[]');
          const localProducts = JSON.parse(localStorage.getItem('ifumo_products_v2') || '[]');
          const localOrders = JSON.parse(localStorage.getItem('ifumo_orders_v2') || '[]');
          if (
            (localStores.length > 0 && (!data.stores || data.stores.length === 0)) ||
            (localProducts.length > 0 && (!data.products || data.products.length === 0))
          ) {
            await fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                stores: localStores,
                products: localProducts,
                orders: localOrders,
              }),
            });
          }
        } catch {
          // Ignore sync notice
        }
      } catch {
        // Offline fallback uses local cache
      }
    }

    fetchInitialBackendState();

    // Connect to Server-Sent Events (SSE) for real-time updates
    let eventSource: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('order_created', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.order) {
            setOrders((prev) => {
              if (prev.some((o) => o.orderId === payload.order.orderId)) return prev;
              return [payload.order, ...prev];
            });
          }
          if (payload.notification) {
            setLiveNotifications((prev) => [payload.notification, ...prev.slice(0, 4)]);
          }
        } catch {
          // Ignore malformed event
        }
      });

      eventSource.addEventListener('order_updated', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.order) {
            setOrders((prev) =>
              prev.map((o) =>
                o.orderId === payload.order.orderId ? payload.order : o
              )
            );
          }
          if (payload.notification) {
            setLiveNotifications((prev) => [payload.notification, ...prev.slice(0, 4)]);
          }
        } catch {
          // Ignore malformed event
        }
      });

      eventSource.addEventListener('product_created', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.product) {
            setProducts((prev) => {
              if (prev.some((p) => p.id === payload.product.id)) return prev;
              return [payload.product, ...prev];
            });
          }
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('product_updated', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.product) {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.product.id ? payload.product : p))
            );
          }
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('product_deleted', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.productId) {
            setProducts((prev) => prev.filter((p) => p.id !== payload.productId));
          }
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('review_created', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.review) {
            setReviews((prev) => {
              if (prev.some((r) => r.reviewId === payload.review.reviewId)) return prev;
              return [payload.review, ...prev];
            });
          }
          if (Array.isArray(payload.stores)) {
            setStores(payload.stores);
          }
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('support_message', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.message) {
            setSupportMessages((prev) => {
              if (prev.some((m) => m.messageId === payload.message.messageId)) return prev;
              return [...prev, payload.message];
            });
          }
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('push_notification', (ev) => {
        try {
          const notif = JSON.parse((ev as MessageEvent).data);
          if (notif && notif.id) {
            setLiveNotifications((prev) => [notif, ...prev.slice(0, 4)]);
          }
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('store_created', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.store) {
            setStores((prev) => {
              if (prev.some((s) => s.id === payload.store.id)) return prev;
              return [payload.store, ...prev];
            });
          }
          if (Array.isArray(payload.products) && payload.products.length > 0) {
            setProducts((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const newProds = payload.products.filter(
                (p: ProductItem) => !existingIds.has(p.id)
              );
              return [...newProds, ...prev];
            });
          }
          if (payload.notification) {
            setLiveNotifications((prev) => [payload.notification, ...prev.slice(0, 4)]);
          }
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('store_updated', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data);
          if (payload.store) {
            setStores((prev) =>
              prev.map((s) => (s.id === payload.store.id ? payload.store : s))
            );
          }
        } catch {
          // Ignore
        }
      });
    }

    return () => {
      isMounted = false;
      eventSource?.close();
    };
  }, []);

  // Firebase Auth Listener (Restores & Syncs Google Account Profile in Firestore + Backend)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        try {
          const existingSnap = await getDoc(userRef);
          if (existingSnap.exists()) {
            const data = existingSnap.data();
            const restoredName = data.displayName || user.displayName || 'Cliente Ifumo';
            const restoredAddr = data.defaultAddress || userAddressLabel || 'Av. Paulista, 1000';
            const restoredPhone = data.phone || userPhone || '(11) 99876-5432';
            const restoredPts = typeof data.loyaltyPoints === 'number' ? data.loyaltyPoints : loyaltyPoints;

            setCheckoutCustomerName(restoredName);
            setUserAddressLabel(restoredAddr);
            setCheckoutAddress(restoredAddr);
            setUserPhone(restoredPhone);
            setLoyaltyPoints(restoredPts);

            try {
              localStorage.setItem(
                'ifumo_saved_user_profile',
                JSON.stringify({
                  displayName: restoredName,
                  defaultAddress: restoredAddr,
                  phone: restoredPhone,
                })
              );
            } catch {
              // Ignore
            }
          } else {
            const initialName = (user.displayName || checkoutCustomerName || 'Cliente Ifumo').slice(0, 80);
            const initialAddr = (userAddressLabel || 'Av. Paulista, 1000').slice(0, 240);
            const initialPhone = (userPhone || '(11) 99876-5432').slice(0, 30);
            const tier = getLoyaltyTier(loyaltyPoints).tier;

            setCheckoutCustomerName(initialName);
            await setDoc(userRef, {
              uid: user.uid,
              displayName: initialName,
              defaultAddress: initialAddr,
              phone: initialPhone,
              loyaltyPoints,
              tier,
              role: 'customer',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          // Also sync with backend /api/users/:uid
          await fetch(`/api/users/${user.uid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              displayName: user.displayName || checkoutCustomerName,
              email: user.email || '',
              photoURL: user.photoURL || '',
              defaultAddress: userAddressLabel,
              phone: userPhone,
              loyaltyPoints,
              tier: getLoyaltyTier(loyaltyPoints).tier,
              role: 'customer',
            }),
          });
        } catch (err) {
          console.warn('Profile sync notice:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Dynamic Canonical & OpenGraph URL Resolution (SEO)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    const canonicalLink = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    if (canonicalLink) {
      canonicalLink.href = canonicalUrl;
    }
    const ogUrlMeta = document.querySelector<HTMLMetaElement>(
      'meta[property="og:url"]'
    );
    if (ogUrlMeta) {
      ogUrlMeta.content = canonicalUrl;
    }
  }, [activeSection]);

  // Public Firestore Real-Time Listeners (Active for all visitors on Vercel & Local)
  useEffect(() => {
    if (!authReady) return;

    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('visibility', '==', 'public')
    );
    const unsubReviews = onSnapshot(
      reviewsQuery,
      (snap) => {
        if (!snap.empty) {
          const remoteReviews: StoreReview[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              reviewId: data.reviewId,
              userId: data.userId,
              authorName: data.authorName,
              storeId: data.storeId,
              storeName: data.storeName,
              rating: data.rating,
              comment: data.comment,
              createdAt: 'Verificado',
            };
          });
          setReviews((prev) => {
            const existingIds = new Set(remoteReviews.map((r) => r.reviewId));
            return [...remoteReviews, ...prev.filter((p) => !existingIds.has(p.reviewId))];
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    );

    const storesQuery = query(
      collection(db, 'stores'),
      where('visibility', '==', 'public')
    );
    const unsubStores = onSnapshot(
      storesQuery,
      (snap) => {
        const removedIds = new Set(
          snap
            .docChanges()
            .filter((c) => c.type === 'removed')
            .map((c) => c.doc.data().id || c.doc.id)
        );
        const remoteStores: PartnerStore[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || data.storeId || d.id,
            name: data.name,
            neighborhood: data.neighborhood,
            address: data.address,
            lat: Number(data.lat) || -23.5649,
            lng: Number(data.lng) || -46.652,
            rating: typeof data.rating === 'number' ? data.rating : 5.0,
            reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 1,
            reviewCountFormatted: data.reviewCountFormatted || 'Novo',
            prepMinutes: Number(data.prepMinutes) || 12,
            etaRangeLabel: data.etaRangeLabel || '20-30 min',
            deliveryLabel: data.deliveryLabel || 'Grátis',
            specialty: data.specialty || 'Cigarros, Sedas, Isqueiros & Tabacaria',
            isOpen: data.isOpen !== false,
            spriteViewBox: data.spriteViewBox || '54 786 196 150',
            ownerId: data.ownerId,
          };
        });
        if (remoteStores.length > 0 || removedIds.size > 0) {
          setStores((prev) => {
            const existingMap = new Map(
              prev.filter((s) => !removedIds.has(s.id)).map((s) => [s.id, s])
            );
            for (const rs of remoteStores) {
              existingMap.set(rs.id, rs);
            }
            return Array.from(existingMap.values());
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'stores');
      }
    );

    const productsQuery = query(
      collection(db, 'products'),
      where('visibility', '==', 'public')
    );
    const unsubProducts = onSnapshot(
      productsQuery,
      (snap) => {
        const removedIds = new Set(
          snap
            .docChanges()
            .filter((c) => c.type === 'removed')
            .map((c) => c.doc.data().id || c.doc.id)
        );
        const remoteProducts: ProductItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            storeId: data.storeId,
            storeName: data.storeName,
            name: data.name,
            category: data.category || 'Cigarros',
            tagLabel: data.tagLabel || 'PRONTA ENTREGA',
            description: data.description || '',
            origin: data.origin || 'Original Lacrado',
            intensity: data.intensity || 'Pronta Entrega',
            rating: typeof data.rating === 'number' ? data.rating : 5.0,
            reviewsCountLabel: data.reviewsCountLabel || '5.0 (Verificado)',
            price: Number(data.price) || 14.5,
            image:
              data.image || '/src/assets/images/cig_marlboro_pack_1794927241031.jpg',
            inStock: data.inStock !== false,
          };
        });
        if (remoteProducts.length > 0 || removedIds.size > 0) {
          setProducts((prev) => {
            const existingMap = new Map(
              prev.filter((p) => !removedIds.has(p.id)).map((p) => [p.id, p])
            );
            for (const rp of remoteProducts) {
              existingMap.set(rp.id, rp);
            }
            return Array.from(existingMap.values());
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'products');
      }
    );

    return () => {
      unsubReviews();
      unsubStores();
      unsubProducts();
    };
  }, [authReady]);

  // Authenticated User Firestore Listeners (Orders)
  useEffect(() => {
    if (!authReady || !currentUser) return;

    const ordersQuery = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid)
    );
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        if (!snap.empty) {
          const remoteOrders: OrderRecord[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              orderId: data.orderId,
              userId: data.userId,
              customerName: data.customerName,
              storeId: data.storeId,
              storeName: data.storeName,
              itemsSummary: data.itemsSummary,
              totalAmount: data.totalAmount,
              deliveryFee: data.deliveryFee,
              paymentMethod: data.paymentMethod,
              stripeTxId: data.stripeTxId,
              deliveryAddress: data.deliveryAddress,
              status: data.status,
              loyaltyEarned: data.loyaltyEarned,
              createdAt: 'Sincronizado na Nuvem',
            };
          });
          setOrders((prev) => {
            const existingIds = new Set(remoteOrders.map((o) => o.orderId));
            return [...remoteOrders, ...prev.filter((p) => !existingIds.has(p.orderId))];
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    return () => {
      unsubOrders();
    };
  }, [authReady, currentUser]);

  const pushToast = (title: string, body: string) => {
    const newToast: PushNotificationToast = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setLiveNotifications((prev) => [newToast, ...prev.slice(0, 4)]);

    // Also trigger native browser Web Notification if granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch {
        // Ignore in restricted iframe
      }
    }
  };

  // Real Geocoding for Custom Address Input or GPS
  const handleCustomAddressGeocode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customAddressInput.trim();
    if (trimmed.length < 3) return;
    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        setUserAddressLabel(data.label || trimmed);
        setUserCoords({ lat: Number(data.lat), lng: Number(data.lng) });
        setCheckoutAddress(`${data.label || trimmed} - São Paulo`);
        pushToast(
          'Endereço Geolocalizado',
          `Distâncias e tempo de entrega atualizados para ${data.label || trimmed}.`
        );
      }
    } finally {
      setIsGeocoding(false);
      setCustomAddressInput('');
      setAddressDropdownOpen(false);
    }
  };

  const handleUseBrowserGpsInHeader = () => {
    if (!('geolocation' in navigator)) {
      setAddressDropdownOpen(false);
      setActiveSection('search');
      return;
    }
    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            setUserAddressLabel(data.label);
            setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setCheckoutAddress(data.label);
          }
        } finally {
          setIsGeocoding(false);
          setAddressDropdownOpen(false);
        }
      },
      () => {
        setIsGeocoding(false);
        setAddressDropdownOpen(false);
        setActiveSection('search');
      },
      { timeout: 5000 }
    );
  };

  // Real Network Search for Open Tabacarias Near the User's Coordinates
  const handleSearchNearbyOpenTabacarias = async (queryText?: string) => {
    setIsSearchingNetwork(true);
    try {
      const qParam = encodeURIComponent(
        (queryText || searchQuery || 'tabacaria').trim()
      );
      const res = await fetch(
        `/api/tabacarias/nearby?lat=${userCoords.lat}&lng=${userCoords.lng}&q=${qParam}&openOnly=true`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.stores) && data.stores.length > 0) {
          setStores(data.stores);
        }
        if (Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
        const openCount = Array.isArray(data.openNearbyStores)
          ? data.openNearbyStores.length
          : data.stores?.filter((s: PartnerStore) => s.isOpen).length || 0;
        pushToast(
          'Varredura da Rede de Tabacarias Concluída',
          `${openCount} tabacarias abertas agora encontradas perto de ${userAddressLabel}.`
        );
      }
    } catch {
      pushToast(
        'Busca na Rede Local',
        `Exibindo tabacarias abertas agora perto de ${userAddressLabel}.`
      );
    } finally {
      setIsSearchingNetwork(false);
    }
  };

  // Cart Calculations
  const cartItems = useMemo(() => {
    return Object.entries(cartQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return null;
        return {
          product,
          quantity,
        };
      })
      .filter((entry): entry is { product: ProductItem; quantity: number } => entry !== null);
  }, [cartQuantities, products]);

  const totalItemsInBag = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const orderTotals = useMemo(
    () =>
      calculateOrderTotals(
        cartItems.map((ci) => ({
          id: ci.product.id,
          name: ci.product.name,
          price: ci.product.price,
          quantity: ci.quantity,
        })),
        activeCoupon?.discountBrl || 0
      ),
    [cartItems, activeCoupon]
  );

  const filteredProducts = useMemo(() => {
    const registeredStoreIds = new Set(stores.map((s) => s.id));
    return products.filter((p) => {
      // Apenas produtos de estabelecimentos cadastrados na plataforma podem aparecer
      if (!registeredStoreIds.has(p.storeId)) return false;
      const matchesCat =
        selectedCategory === 'Todas' || p.category === selectedCategory;
      const matchesStore =
        selectedStoreFilter === 'all' || p.storeId === selectedStoreFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.storeName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCat && matchesStore && matchesSearch;
    });
  }, [products, stores, selectedCategory, selectedStoreFilter, searchQuery]);

  const filteredStores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.specialty.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q)
    );
  }, [stores, searchQuery]);

  const handleAddToCart = (product: ProductItem) => {
    if (!product.inStock) return;
    setCartQuantities((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] || 0) + 1,
    }));
    pushToast(
      'Item Adicionado ao Carrinho',
      `${product.name} adicionado. +${Math.round(product.price * 1.5)} pts no Clube Ifumo!`
    );
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartQuantities((prev) => {
      const next = (prev[productId] || 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleApplyCouponCode = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const foundReward = LOYALTY_REWARDS.find((r) => r.code.toUpperCase() === code);
    if (foundReward) {
      setActiveCoupon({ code: foundReward.code, discountBrl: foundReward.discountBrl });
      setCouponInput('');
      pushToast(
        `Cupom ${foundReward.code} Aplicado!`,
        `Desconto de R$ ${foundReward.discountBrl.toFixed(2)} ativado no seu pedido.`
      );
    } else if (code === 'IFUMO15' || code === 'BEMVINDO') {
      setActiveCoupon({ code, discountBrl: 15 });
      setCouponInput('');
      pushToast(`Cupom ${code} Aplicado!`, 'Desconto de R$ 15,00 ativado no seu pedido.');
    } else {
      setCheckoutError('Cupom inválido. Tente IFUMO30, RESERVA65 ou IFUMO15.');
    }
  };

  const handleReorderPastOrder = (ord: OrderRecord) => {
    const storeProducts = products.filter((p) => p.storeId === ord.storeId && p.inStock);
    const fallbackProduct = storeProducts[0] || products[0];
    if (!fallbackProduct) return;

    setCartQuantities((prev) => ({
      ...prev,
      [fallbackProduct.id]: (prev[fallbackProduct.id] || 0) + 1,
    }));
    setIsCartOpen(true);
    pushToast(
      `Itens de ${ord.storeName} Adicionados`,
      'Revise sua sacola para concluir a recompra rápida via Stripe.'
    );
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      pushToast(
        'Conta Google Conectada!',
        'Suas informações pessoais, endereço, pontos do Clube Ifumo e pedidos estão sincronizados.'
      );
    } catch (err) {
      console.warn('Login popup cancelled or blocked:', err);
      pushToast(
        'Login Google',
        'A janela de autenticação Google foi fechada ou bloqueada pelo navegador.'
      );
    }
  };

  const handleSaveUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = checkoutCustomerName.trim() || 'Cliente Ifumo';
    const cleanAddr = userAddressLabel.trim() || 'Av. Paulista, 1000';
    const cleanPhone = userPhone.trim() || '(11) 99876-5432';

    setIsSavingProfile(true);
    setProfileSavedFeedback('');

    try {
      setCheckoutCustomerName(cleanName);
      setUserAddressLabel(cleanAddr);
      setCheckoutAddress(cleanAddr);
      setUserPhone(cleanPhone);

      // 1. Save in LocalStorage for instant offline & reload restoration
      try {
        localStorage.setItem(
          'ifumo_saved_user_profile',
          JSON.stringify({
            displayName: cleanName,
            defaultAddress: cleanAddr,
            phone: cleanPhone,
          })
        );
      } catch {
        // Ignore storage error
      }

      // 2. Geocode saved address and persist in Backend (/api/users/:uid)
      const targetUid = currentUser?.uid || 'demo_user_1';
      if (!simulatedOffline) {
        try {
          const geoRes = await fetch(`/api/geocode?q=${encodeURIComponent(cleanAddr)}`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.lat && geoData.lng) {
              setUserCoords({ lat: Number(geoData.lat), lng: Number(geoData.lng) });
            }
          }
        } catch {
          // Ignore geocode error
        }

        try {
          await fetch(`/api/users/${targetUid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              displayName: cleanName.slice(0, 80),
              email: currentUser?.email || '',
              photoURL: currentUser?.photoURL || '',
              defaultAddress: cleanAddr.slice(0, 240),
              phone: cleanPhone.slice(0, 30),
              loyaltyPoints,
              tier: getLoyaltyTier(loyaltyPoints).tier,
              role: 'customer',
            }),
          });
        } catch {
          // Ignore backend error
        }
      }

      // 3. Persist in Firebase Firestore (users/{uid}) when logged in with Google
      if (currentUser && !simulatedOffline) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const snap = await getDoc(userRef);
          const tier = getLoyaltyTier(loyaltyPoints).tier;
          if (snap.exists()) {
            await updateDoc(userRef, {
              displayName: cleanName.slice(0, 80),
              defaultAddress: cleanAddr.slice(0, 240),
              phone: cleanPhone.slice(0, 30),
              loyaltyPoints,
              tier,
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(userRef, {
              uid: currentUser.uid,
              displayName: cleanName.slice(0, 80),
              defaultAddress: cleanAddr.slice(0, 240),
              phone: cleanPhone.slice(0, 30),
              loyaltyPoints,
              tier,
              role: 'customer',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
        }
      }

      setProfileSavedFeedback(
        currentUser
          ? 'Informações salvas e sincronizadas na sua Conta Google (Firestore)!'
          : 'Informações salvas com sucesso no seu perfil!'
      );
      pushToast(
        'Perfil Atualizado com Sucesso',
        `${cleanName} · Entrega padrão em ${cleanAddr}.`
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStripeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    const cleanName = checkoutCustomerName.trim();
    const cleanAddress = checkoutAddress.trim();
    if (cleanName.length < 2) {
      setCheckoutError('Por favor, informe o nome completo do recebedor (maior de 18 anos).');
      return;
    }
    if (cleanAddress.length < 6) {
      setCheckoutError('Por favor, informe o endereço completo para entrega.');
      return;
    }

    setCheckoutError('');
    setIsProcessingStripe(true);

    try {
      const primaryStoreId = cartItems[0].product.storeId;
      const primaryStoreName = cartItems[0].product.storeName;
      const itemsSummary = cartItems
        .map((ci) => `${ci.quantity}x ${ci.product.name}`)
        .join(', ')
        .slice(0, 490);

      const finalTotal =
        orderTotals.subtotal - orderTotals.discount > 0
          ? Number((orderTotals.subtotal - orderTotals.discount).toFixed(2))
          : orderTotals.total;

      const paymentLabels: Record<string, string> = {
        pix_entrega: 'Pix na Entrega',
        dinheiro_entrega:
          changeFor && changeFor.trim() !== 'Sem troco'
            ? `Dinheiro na Entrega (Troco p/ ${changeFor.trim()})`
            : 'Dinheiro na Entrega (Sem troco)',
        cartao_credito_entrega: 'Cartão de Crédito na Entrega',
        cartao_debito_entrega: 'Cartão de Débito na Entrega',
      };
      const chosenPaymentLabel =
        paymentLabels[paymentMethod] || 'Pagamento na Entrega';

      let createdOrder: OrderRecord | null = null;
      let stripeTxId = `pagamento_entrega_${paymentMethod}_${Date.now().toString(36)}`;

      if (!simulatedOffline) {
        const res = await fetch('/api/checkout/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cartItems.map((ci) => ({
              id: ci.product.id,
              name: ci.product.name,
              price: ci.product.price,
              quantity: ci.quantity,
            })),
            totalAmount: finalTotal,
            deliveryFee: 0,
            paymentMethod,
            changeFor: paymentMethod === 'dinheiro_entrega' ? changeFor : undefined,
            customerName: cleanName,
            deliveryAddress: cleanAddress,
            storeId: primaryStoreId,
            storeName: primaryStoreName,
            couponCode: activeCoupon?.code || null,
            userId: currentUser?.uid || 'demo_user_1',
            loyaltyEarned: orderTotals.loyaltyEarned,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.transactionId) {
            stripeTxId = data.transactionId;
          }
          if (data.order) {
            createdOrder = data.order;
          }
        }
      }

      const newOrder: OrderRecord = createdOrder || {
        orderId: `ord_ifumo_${Math.floor(1000 + Math.random() * 9000)}`,
        userId: currentUser?.uid || 'demo_user_1',
        customerName: cleanName.slice(0, 80),
        storeId: primaryStoreId,
        storeName: primaryStoreName.slice(0, 80),
        itemsSummary,
        totalAmount: finalTotal,
        deliveryFee: 0,
        paymentMethod,
        stripeTxId: `${stripeTxId} · ${chosenPaymentLabel}`.slice(0, 110),
        deliveryAddress: cleanAddress.slice(0, 240),
        status: 'confirmed',
        loyaltyEarned: orderTotals.loyaltyEarned,
        createdAt: 'Agora mesmo',
      };

      if (currentUser && !simulatedOffline) {
        try {
          await setDoc(doc(db, 'orders', newOrder.orderId), {
            ...newOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `orders/${newOrder.orderId}`);
        }
      }

      setOrders((prev) => {
        if (prev.some((o) => o.orderId === newOrder.orderId)) return prev;
        return [newOrder, ...prev];
      });
      setLoyaltyPoints((prev) => prev + orderTotals.loyaltyEarned);
      setCartQuantities({});
      setActiveCoupon(null);
      setIsCartOpen(false);
      setSelectedMapStoreId(primaryStoreId);
      setActiveSection('orders');

      pushToast(
        `Pedido Confirmado (#${newOrder.orderId})`,
        `${chosenPaymentLabel} selecionado! O motoboy levará a maquininha/QR Code na entrega.`
      );
    } finally {
      setIsProcessingStripe(false);
    }
  };

  const handleAdvanceOrderStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const targetOrder = orders.find((o) => o.orderId === orderId);
    setOrders((prev) =>
      prev.map((o) => (o.orderId === orderId ? { ...o, status: nextStatus } : o))
    );

    if (!simulatedOffline) {
      try {
        await fetch(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus, order: targetOrder }),
        });
      } catch {
        // Fallback to local state if offline
      }
    }

    if (currentUser && targetOrder && !simulatedOffline) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore order update warning:', err);
      }
    }

    const labelMap: Record<OrderStatus, string> = {
      confirmed: 'Pedido Confirmado',
      preparing: 'Em Preparo na Tabacaria',
      delivering: 'Motoboy Saiu para Entrega (20-30 min)',
      delivered: 'Pedido Entregue com Sucesso',
      cancelled: 'Pedido Cancelado',
    };

    pushToast(
      `Atualização em Tempo Real · #${orderId}`,
      `Novo status: ${labelMap[nextStatus]}.`
    );
  };

  const handleCreateProduct = async (payload: {
    storeId: string;
    name: string;
    category: ProductItem['category'];
    price: number;
    description: string;
    origin?: string;
    image?: string;
  }) => {
    const store = stores.find((s) => s.id === payload.storeId) || stores[0];
    if (!store) {
      throw new Error('Cadastre seu estabelecimento primeiro no Perfil.');
    }

    const prodId = `prod_${Date.now().toString(36)}`;
    let createdProd: ProductItem | null = null;

    if (!simulatedOffline) {
      try {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            id: prodId,
            storeId: store.id,
            storeName: store.name,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.product) {
            createdProd = data.product;
          }
        }
      } catch {
        // Fallback below if offline
      }
    }

    const finalProduct: ProductItem = createdProd || {
      id: prodId,
      storeId: store.id,
      storeName: store.name,
      name: payload.name.slice(0, 90),
      category: payload.category,
      tagLabel: 'PRONTA ENTREGA',
      description: payload.description.slice(0, 200),
      origin: (payload.origin || 'Original Lacrado').slice(0, 40),
      intensity: 'Pronta Entrega',
      rating: 5.0,
      reviewsCountLabel: '5.0 (Verificado)',
      price: payload.price,
      image:
        payload.image || '/src/assets/images/cig_marlboro_pack_1794927241031.jpg',
      spriteViewBox: '42 578 108 108',
      inStock: true,
    };

    setProducts((prev) => {
      if (prev.some((p) => p.id === finalProduct.id)) return prev;
      return [finalProduct, ...prev];
    });

    if (currentUser && !simulatedOffline) {
      try {
        await setDoc(doc(db, 'products', finalProduct.id), {
          id: finalProduct.id,
          ownerId: currentUser.uid,
          storeId: finalProduct.storeId,
          storeName: finalProduct.storeName.slice(0, 80),
          name: finalProduct.name.slice(0, 90),
          category: finalProduct.category,
          tagLabel: finalProduct.tagLabel.slice(0, 30),
          description: finalProduct.description.slice(0, 200),
          origin: finalProduct.origin.slice(0, 40),
          intensity: finalProduct.intensity.slice(0, 40),
          rating: finalProduct.rating,
          reviewsCountLabel: finalProduct.reviewsCountLabel.slice(0, 30),
          price: finalProduct.price,
          image: finalProduct.image.slice(0, 300),
          inStock: finalProduct.inStock,
          visibility: 'public',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore product create sync warning:', err);
      }
    }

    pushToast(
      'Item Adicionado ao Cardápio iFood!',
      `${finalProduct.name} já está disponível na vitrine de ${finalProduct.storeName}.`
    );
  };

  const handleToggleProductStock = async (productId: string) => {
    const target = products.find((p) => p.id === productId);
    if (!target) return;
    const nextInStock = !target.inStock;

    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, inStock: nextInStock } : p))
    );

    if (!simulatedOffline) {
      try {
        await fetch(`/api/products/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inStock: nextInStock, product: target }),
        });
      } catch {
        // Offline fallback
      }
    }

    if (currentUser && !simulatedOffline) {
      try {
        await updateDoc(doc(db, 'products', productId), {
          inStock: nextInStock,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore if not in Firestore
      }
    }
  };

  const handleUpdateProductPrice = async (productId: string, newPrice: number) => {
    const target = products.find((p) => p.id === productId);
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, price: newPrice } : p))
    );
    if (!simulatedOffline) {
      try {
        await fetch(`/api/products/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: newPrice, product: target }),
        });
      } catch {
        // Ignore
      }
    }
    if (currentUser && !simulatedOffline) {
      try {
        await updateDoc(doc(db, 'products', productId), {
          price: newPrice,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore
      }
    }
    pushToast('Preço Atualizado no Cardápio', `Novo valor: R$ ${newPrice.toFixed(2)}.`);
  };

  const handleDeleteProduct = async (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    if (!simulatedOffline) {
      try {
        await fetch(`/api/products/${productId}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore
      }
    }
    if (currentUser && !simulatedOffline) {
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch {
        // Ignore
      }
    }
    pushToast('Item Removido', 'O produto foi removido do cardápio.');
  };

  const handleAddReview = async (
    storeId: string,
    rating: number,
    comment: string,
    authorName: string
  ) => {
    const store = stores.find((s) => s.id === storeId) || stores[0];
    let createdReview: StoreReview | null = null;

    if (!simulatedOffline) {
      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: store.id,
            rating,
            comment,
            authorName,
            userId: currentUser?.uid || 'demo_user_1',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.review) createdReview = data.review;
          if (Array.isArray(data.stores)) setStores(data.stores);
        }
      } catch {
        // Offline fallback
      }
    }

    const newReview: StoreReview = createdReview || {
      reviewId: `rev_${Date.now().toString(36)}`,
      userId: currentUser?.uid || 'demo_user_1',
      authorName: authorName.slice(0, 80),
      storeId: store.id,
      storeName: store.name,
      rating,
      comment: comment.slice(0, 600),
      createdAt: 'Agora mesmo',
    };

    if (currentUser && !simulatedOffline) {
      try {
        await setDoc(doc(db, 'reviews', newReview.reviewId), {
          ...newReview,
          visibility: 'public',
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `reviews/${newReview.reviewId}`);
      }
    }

    setReviews((prev) => {
      if (prev.some((r) => r.reviewId === newReview.reviewId)) return prev;
      return [newReview, ...prev];
    });
    setLoyaltyPoints((prev) => prev + 25);
    pushToast(
      'Avaliação Publicada (+25 pts)',
      `Obrigado por avaliar ${store.name}! A nota da loja foi atualizada em tempo real.`
    );
  };

  const handleRedeemReward = (reward: LoyaltyReward) => {
    if (loyaltyPoints < reward.pointsCost) return;
    setLoyaltyPoints((prev) => prev - reward.pointsCost);
    setActiveCoupon({ code: reward.code, discountBrl: reward.discountBrl });
    pushToast(
      `Cupom ${reward.code} Ativado!`,
      `Desconto de R$ ${reward.discountBrl.toFixed(2)} aplicado automaticamente no carrinho.`
    );
  };

  const handleSendSupportMessage = async (
    text: string,
    senderRole: 'customer' | 'support'
  ) => {
    const senderName =
      senderRole === 'customer'
        ? checkoutCustomerName || 'Cliente Ifumo'
        : 'Suporte Ifumo 24h';

    if (!simulatedOffline) {
      try {
        const res = await fetch('/api/support/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            senderRole,
            senderName,
            userId: currentUser?.uid || 'demo_user_1',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.message) {
            setSupportMessages((prev) => {
              if (prev.some((m) => m.messageId === data.message.messageId)) return prev;
              return [...prev, data.message];
            });
          }
        }
      } catch {
        // Fallback below
      }
    }

    if (currentUser && !simulatedOffline) {
      const msgId = `msg_${Date.now().toString(36)}`;
      try {
        await setDoc(doc(db, 'supportMessages', msgId), {
          messageId: msgId,
          userId: currentUser.uid,
          senderName: senderName.slice(0, 80),
          senderRole,
          text: text.slice(0, 500),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Support message cloud sync warning:', err);
      }
    }

    if (senderRole === 'customer') {
      setTimeout(async () => {
        const replyText =
          'Recebemos sua mensagem! A tabacaria confirmou que seus itens seguem lacrados com entrega expressa em até 30 min.';
        try {
          const res = await fetch('/api/support/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: replyText,
              senderRole: 'support',
              senderName: 'Suporte Ifumo 24h',
              userId: currentUser?.uid || 'demo_user_1',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.message) {
              setSupportMessages((prev) => {
                if (prev.some((m) => m.messageId === data.message.messageId)) return prev;
                return [...prev, data.message];
              });
            }
          }
        } catch {
          // Offline fallback
        }
      }, 800);
    }
  };

  const handleTriggerCustomPush = async (title: string, body: string) => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignore
      }
    }

    if (!simulatedOffline) {
      try {
        await fetch('/api/notifications/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, segment: 'clube_ifumo' }),
        });
      } catch {
        // Fallback to local push toast if offline
      }
    }
    pushToast(title, body);
  };

  const handleRegisterPlace = async (payload: PlaceRegistrationPayload) => {
    const fallbackStoreId = `place_${Date.now().toString(36)}`;
    let createdStore: PartnerStore | null = null;

    if (!simulatedOffline) {
      try {
        const res = await fetch('/api/stores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            id: fallbackStoreId,
            ownerId: currentUser?.uid || 'guest_partner',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.store) {
            createdStore = data.store;
          }
        }
      } catch {
        // Fallback to local/Firestore creation below
      }
    }

    const finalStore: PartnerStore = createdStore || {
      id: fallbackStoreId,
      ownerId: currentUser?.uid || 'guest_partner',
      name: payload.name.trim().slice(0, 80),
      neighborhood: (payload.neighborhood || 'Centro').trim().slice(0, 80),
      address: payload.address.trim().slice(0, 240),
      lat: Number(payload.lat) || -23.5649,
      lng: Number(payload.lng) || -46.652,
      rating: 5.0,
      reviewCount: 1,
      reviewCountFormatted: 'Novo',
      prepMinutes: 10,
      etaRangeLabel: (payload.etaRangeLabel || '20-30 min').slice(0, 30),
      deliveryLabel: (payload.deliveryLabel || 'Grátis').slice(0, 30),
      specialty: (
        payload.specialty ||
        'Marlboro, Camel, Kretek, Harmony, Charutos, Sedas & Isqueiros'
      ).slice(0, 200),
      isOpen: payload.isOpen !== false,
      spriteViewBox: '54 824 164 124',
    };

    setStores((prev) => {
      if (prev.some((s) => s.id === finalStore.id)) return prev;
      return [finalStore, ...prev];
    });

    setSelectedMapStoreId(finalStore.id);

    if (currentUser && !simulatedOffline) {
      try {
        await setDoc(doc(db, 'stores', finalStore.id), {
          id: finalStore.id,
          ownerId: currentUser.uid,
          name: finalStore.name.slice(0, 80),
          neighborhood: finalStore.neighborhood.slice(0, 80),
          address: finalStore.address.slice(0, 240),
          lat: finalStore.lat,
          lng: finalStore.lng,
          rating: finalStore.rating,
          reviewCount: finalStore.reviewCount || 1,
          reviewCountFormatted: finalStore.reviewCountFormatted.slice(0, 20),
          prepMinutes: finalStore.prepMinutes,
          etaRangeLabel: finalStore.etaRangeLabel.slice(0, 30),
          deliveryLabel: finalStore.deliveryLabel.slice(0, 30),
          specialty: finalStore.specialty.slice(0, 200),
          isOpen: finalStore.isOpen,
          spriteViewBox: finalStore.spriteViewBox.slice(0, 40),
          visibility: 'public',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Firestore store sync warning:', err);
      }
    }

    pushToast(
      'Novo Lugar Cadastrado!',
      `${finalStore.name} (${finalStore.neighborhood}) agora está ativo no mapa e na lista.`
    );
  };

  const handleToggleStoreOpen = async (storeId: string, nextIsOpen: boolean) => {
    const target = stores.find((s) => s.id === storeId);
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, isOpen: nextIsOpen } : s))
    );
    try {
      await fetch(`/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: nextIsOpen, store: target }),
      });
    } catch {
      // Ignore network error
    }
    if (currentUser && !simulatedOffline) {
      try {
        if (target && target.ownerId === currentUser.uid) {
          await updateDoc(doc(db, 'stores', storeId), {
            isOpen: nextIsOpen,
            updatedAt: serverTimestamp(),
          });
        }
      } catch {
        // Ignore if not owner or doc not in Firestore
      }
    }
  };

  const activeOrder =
    orders.find((o) => ['confirmed', 'preparing', 'delivering'].includes(o.status)) ||
    orders[0] ||
    null;

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white pb-24">
      {/* Google Maps Platform Demo Key Quota Banner (Mandatory Case A) */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Mobile-First App Shell Container */}
      <div className="max-w-[480px] md:max-w-4xl mx-auto px-4 pt-3 space-y-3.5">
        {/* 1. TOP HEADER ROW — Exact match to image_dc88fa52.png */}
        <header className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('Todas');
              setSelectedStoreFilter('all');
              setActiveSection('home');
            }}
            className="text-left focus:outline-none"
          >
            <span className="text-[36px] sm:text-[40px] font-extrabold tracking-tight text-[#F5A623] leading-none">
              Ifumo
            </span>
          </button>

          <div className="flex items-center gap-2.5">
            {/* Quick Google Login Pill (when not signed in) or User Name Pill */}
            <button
              type="button"
              onClick={() =>
                currentUser ? setActiveSection('profile') : handleGoogleLogin()
              }
              className="px-2.5 py-1.5 rounded-full bg-[#1A1B1E] hover:bg-[#24252A] border border-[#2C2D33] flex items-center gap-1.5 text-[11px] font-bold text-white transition-colors"
            >
              <GoogleBadgeIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[110px]">
                {currentUser
                  ? (currentUser.displayName || checkoutCustomerName).split(' ')[0]
                  : 'Entrar Google'}
              </span>
            </button>

            {/* Circular Dark Gray Profile Button (Exact match to image_dc88fa52.png) */}
            <button
              type="button"
              onClick={() => setActiveSection('profile')}
              aria-label="Abrir Perfil, Login Google e Dados Salvos"
              className="relative w-10 h-10 rounded-full bg-[#24252A] hover:bg-[#2E3036] flex items-center justify-center text-white transition-colors overflow-hidden"
            >
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={checkoutCustomerName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-5 h-5 fill-white text-white" />
              )}
              {currentUser && (
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-2 ring-[#0B0B0D]" />
              )}
            </button>

            {/* Shopping Cart Icon with Red Badge */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Abrir carrinho com ${totalItemsInBag} itens`}
              className="relative w-10 h-10 flex items-center justify-center text-white hover:text-[#F5A623] transition-colors"
            >
              <ShoppingCart className="w-6 h-6 stroke-[2.2]" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-[#EF4444] text-white text-[11px] font-extrabold flex items-center justify-center font-mono-tabular shadow-md">
                {totalItemsInBag}
              </span>
            </button>
          </div>
        </header>

        {/* 2. ADDRESS BAR — Exact match: "Entregar em: Av. Paulista, 1000" + Live Geocoding */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddressDropdownOpen((prev) => !prev)}
            aria-expanded={addressDropdownOpen}
            className="w-[84%] sm:w-[340px] rounded-2xl bg-[#1A1B1E] border border-[#2C2D33] px-3.5 py-2 flex items-center justify-between gap-2 text-left hover:border-[#F5A623]/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <MapPin className="w-5 h-5 text-[#F5A623] shrink-0 fill-[#F5A623]/20" />
              <div className="min-w-0">
                <span className="block text-[11px] text-[#9CA3AF] leading-tight">
                  Entregar em:
                </span>
                <span className="block text-[14px] font-bold text-white truncate leading-tight">
                  {userAddressLabel}
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#D1D5DB] shrink-0" />
          </button>

          {addressDropdownOpen && (
            <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-[#1A1B1E] border border-[#2C2D33] shadow-2xl p-3 z-40 space-y-2.5">
              {/* Real Geocoding Input */}
              <form onSubmit={handleCustomAddressGeocode} className="flex gap-1.5">
                <input
                  type="text"
                  value={customAddressInput}
                  onChange={(e) => setCustomAddressInput(e.target.value)}
                  placeholder="Digite rua e número..."
                  className="flex-1 rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
                <button
                  type="submit"
                  disabled={isGeocoding}
                  className="px-3 py-2 rounded-xl bg-[#F5A623] text-[#0B0B0D] text-xs font-extrabold shrink-0"
                >
                  {isGeocoding ? '...' : 'OK'}
                </button>
              </form>

              <button
                type="button"
                onClick={handleUseBrowserGpsInHeader}
                className="w-full px-3 py-2 rounded-xl bg-[#24252A] hover:bg-[#2E3036] text-xs font-bold text-[#F5A623] flex items-center gap-2"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Usar Meu GPS Atual</span>
              </button>

              <div className="space-y-1 pt-1 border-t border-[#26272B]">
                {QUICK_ADDRESSES.map((addr) => (
                  <button
                    key={addr.label}
                    type="button"
                    onClick={() => {
                      setUserAddressLabel(addr.label);
                      setUserCoords({ lat: addr.lat, lng: addr.lng });
                      setCheckoutAddress(`${addr.label} - São Paulo`);
                      setAddressDropdownOpen(false);
                      pushToast(
                        'Endereço Atualizado',
                        `Entregas calculadas para ${addr.label}.`
                      );
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                      userAddressLabel === addr.label
                        ? 'bg-[#F5A623]/15 text-[#F5A623]'
                        : 'text-white hover:bg-[#24252A]'
                    }`}
                  >
                    <span>{addr.label}</span>
                    {userAddressLabel === addr.label && <span>✓</span>}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setAddressDropdownOpen(false);
                  setActiveSection('search');
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-[#F5A623] hover:bg-[#24252A] border-t border-[#26272B] pt-2"
              >
                Abrir Mapa GPS em Tempo Real →
              </button>
            </div>
          )}
        </div>

        {/* MAIN CONTENT BY TAB */}
        <main className="space-y-4">
          {/* TAB 1: INÍCIO (Exact layout from image_dc88fa52.png) */}
          {activeSection === 'home' && (
            <div className="space-y-4">
              {/* 3. SEARCH INPUT BAR — "Buscar tabacaria, cigarro, seda..." */}
              <div className="relative">
                <Search className="w-5 h-5 text-[#9CA3AF] absolute left-4 top-1/2 -translate-y-1/2" />
                <label htmlFor="home-search-input" className="sr-only">
                  Buscar tabacaria, cigarro, seda
                </label>
                <input
                  id="home-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar tabacaria, cigarro, seda..."
                  className="w-full rounded-2xl bg-[#1A1B1E] border border-[#242529] pl-11 pr-4 py-3 text-[14px] text-white placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#F5A623]"
                />
              </div>

              {/* 4. HERO BANNER — "Entrega em até 30 min · As melhores tabacarias perto de você" */}
              <section
                aria-label="Entrega expressa em até 30 minutos"
                onClick={() => {
                  const el = document.getElementById('lojas-perto-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="relative rounded-2xl overflow-hidden border border-[#3B2112] bg-[#210C05] cursor-pointer shadow-lg"
              >
                <ReferenceSprite
                  viewBox="40 348 784 202"
                  label="Entrega em até 30 min — As melhores tabacarias perto de você com motoboy Ifumo"
                  className="w-full aspect-[784/202] block"
                />
                <div className="sr-only">
                  <h1>Entrega em até 30 min</h1>
                  <p>As melhores tabacarias perto de você</p>
                </div>
              </section>

              {/* 5. 6 CIRCULAR CATEGORIES — Cigarros, Tabaco, Charutos, Seda, Isqueiros, Vape */}
              <section aria-label="Categorias de produtos" className="pt-0.5">
                <div className="grid grid-cols-6 gap-2 sm:gap-4">
                  {CATEGORY_CIRCLES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory((prev) =>
                            prev === cat.id ? 'Todas' : cat.id
                          );
                          const el = document.getElementById('catalogo-produtos-home');
                          el?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex flex-col items-center gap-1.5 group focus:outline-none"
                      >
                        <div
                          className={`w-[54px] h-[54px] sm:w-20 sm:h-20 rounded-full overflow-hidden transition-transform ${
                            isSelected
                              ? 'ring-2 ring-[#F5A623] scale-105'
                              : 'group-hover:scale-105'
                          }`}
                        >
                          <ReferenceSprite
                            viewBox={cat.viewBox}
                            label={cat.label}
                            className="w-full h-full block"
                          />
                        </div>
                        <span
                          className={`text-[11px] sm:text-xs font-medium tracking-tight ${
                            isSelected ? 'text-[#F5A623] font-bold' : 'text-[#E5E7EB]'
                          }`}
                        >
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 6. LOJAS PERTO DE VOCÊ — Exclusivamente Estabelecimentos Cadastrados na Plataforma */}
              <section
                id="lojas-perto-section"
                aria-labelledby="lojas-perto-heading"
                className="space-y-2.5 pt-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="lojas-perto-heading"
                    className="text-[19px] sm:text-2xl font-extrabold text-white tracking-tight"
                  >
                    Lojas perto de você
                  </h2>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSearchNearbyOpenTabacarias()}
                      disabled={isSearchingNetwork}
                      className="px-2.5 py-1.5 rounded-xl bg-[#1A1B1E] hover:bg-[#24252A] border border-[#F5A623]/50 text-[11px] font-extrabold text-[#F5A623] flex items-center gap-1.5 transition-colors"
                    >
                      <Radar
                        className={`w-3.5 h-3.5 ${
                          isSearchingNetwork ? 'animate-spin' : ''
                        }`}
                      />
                      <span>
                        {isSearchingNetwork
                          ? 'Atualizando...'
                          : 'Buscar Abertas'}
                      </span>
                    </button>

                    {(selectedStoreFilter !== 'all' ||
                      selectedCategory !== 'Todas') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStoreFilter('all');
                          setSelectedCategory('Todas');
                        }}
                        className="text-xs font-bold text-[#F5A623] hover:underline"
                      >
                        Limpar filtro
                      </button>
                    )}
                  </div>
                </div>

                {filteredStores.filter((s) => s.isOpen).length === 0 ? (
                  <div className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 text-center space-y-2.5">
                    <Store className="w-7 h-7 text-[#F5A623] mx-auto" />
                    <p className="text-sm font-bold text-white">
                      Nenhum estabelecimento cadastrado perto de você ainda.
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      Apenas estabelecimentos oficialmente cadastrados na plataforma aparecem nesta lista. Para cadastrar seu estabelecimento e produtos, acesse a aba Perfil.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection('profile');
                        setProfileSubTab('admin');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#F5A623] hover:bg-[#F59E0B] text-[#0B0B0D] text-xs font-extrabold transition-colors"
                    >
                      Ir ao Perfil para Cadastrar Estabelecimento
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredStores
                      .filter((s) => s.isOpen)
                      .map((store) => {
                        const isSelected = selectedStoreFilter === store.id;
                        const distKm = calculateDistanceKm(
                          userCoords.lat,
                          userCoords.lng,
                          store.lat,
                          store.lng
                        );
                        return (
                          <div
                            key={store.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedStoreFilter((prev) =>
                                prev === store.id ? 'all' : store.id
                              );
                              const el = document.getElementById(
                                'catalogo-produtos-home'
                              );
                              el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedStoreFilter((prev) =>
                                  prev === store.id ? 'all' : store.id
                                );
                              }
                            }}
                            className={`rounded-2xl bg-[#1A1B1E] border p-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#F5A623] ring-1 ring-[#F5A623]/40'
                                : 'border-[#25262B] hover:border-[#3A3B42]'
                            }`}
                          >
                            {/* Left Store Thumbnail */}
                            <div className="w-[84px] h-[64px] sm:w-28 sm:h-20 rounded-xl overflow-hidden shrink-0 border border-[#2C2D33] bg-[#0B0B0D]">
                              <ReferenceSprite
                                viewBox={store.spriteViewBox}
                                label={store.name}
                                className="w-full h-full block"
                              />
                            </div>

                            {/* Middle Store Info + Top-Right Aberto Pill */}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-1.5">
                                <h3 className="text-[14px] sm:text-base font-bold text-white truncate">
                                  {store.name}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-[#0E3A2F] text-[#4ADE80] text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                                  <span>Aberto</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-[#F5A623] text-xs leading-none">
                                  ★
                                </span>
                                <span className="font-bold text-white">
                                  {store.rating.toFixed(1)}
                                </span>
                                <span className="text-[#9CA3AF]">
                                  ({store.reviewCountFormatted})
                                </span>
                                <span className="text-[#4B5563]">·</span>
                                <span className="text-[#9CA3AF] font-mono-tabular">
                                  {distKm} km
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-[#D1D5DB] whitespace-nowrap pt-0.5">
                                <span className="inline-flex items-center gap-1">
                                  <Bike className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                                  <span>{store.etaRangeLabel}</span>
                                </span>
                                <span className="text-[#4B5563]">|</span>
                                <span className="inline-flex items-center gap-1">
                                  <Truck className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                                  <span>{store.deliveryLabel}</span>
                                </span>
                              </div>
                            </div>

                            {/* Right Chevron */}
                            <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>

              {/* 7. VITRINE DE PRODUTOS DAS TABACARIAS (Interactive Product Cards Below the Fold) */}
              <section
                id="catalogo-produtos-home"
                aria-labelledby="catalogo-produtos-heading"
                className="space-y-3 pt-3 border-t border-[#1F2025]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#F5A623]">
                      Catálogo Express · Entrega Grátis
                    </p>
                    <h2
                      id="catalogo-produtos-heading"
                      className="text-lg font-extrabold text-white"
                    >
                      {selectedCategory !== 'Todas'
                        ? `Categoria: ${selectedCategory}`
                        : selectedStoreFilter !== 'all'
                        ? `Cardápio: ${
                            stores.find((s) => s.id === selectedStoreFilter)?.name
                          }`
                        : 'Cigarros, Sedas & Destaques 24h'}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCartOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#F5A623]/15 text-[#F5A623] text-xs font-bold font-mono-tabular"
                  >
                    Sacola ({totalItemsInBag}) · R$ {orderTotals.subtotal.toFixed(2)}
                  </button>
                </div>

                {/* Selected Store Real Distance & ETA Banner */}
                {selectedStoreFilter !== 'all' && (() => {
                  const st = stores.find((s) => s.id === selectedStoreFilter);
                  if (!st) return null;
                  const dist = calculateDistanceKm(userCoords.lat, userCoords.lng, st.lat, st.lng);
                  const eta = estimateDeliveryMinutes(dist, st.prepMinutes);
                  return (
                    <div className="p-3 rounded-2xl bg-[#1A1B1E] border border-[#F5A623]/40 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="font-bold text-white">{st.name} · {st.neighborhood}</p>
                        <p className="text-[#9CA3AF]">
                          Distância GPS: <strong className="text-[#F5A623]">{dist} km</strong> · Tempo estimado: <strong className="text-[#4ADE80]">~{eta} min</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMapStoreId(st.id);
                          setActiveSection('search');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#0B0B0D] border border-[#26272B] text-[#F5A623] font-bold shrink-0"
                      >
                        Ver no Mapa
                      </button>
                    </div>
                  );
                })()}

                {/* Real-Time Push Notification Strip */}
                {liveNotifications.length > 0 && (
                  <div
                    role="region"
                    aria-label="Notificações em tempo real"
                    className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Bell className="w-4 h-4 text-[#F5A623] shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-white">
                          {liveNotifications[0].title}
                        </span>
                        <span className="mx-1.5 text-[#6B7280]">·</span>
                        <span className="text-[#9CA3AF]">
                          {liveNotifications[0].body}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLiveNotifications((prev) => prev.slice(1))}
                      aria-label="Dispensar notificação"
                      className="text-[#9CA3AF] hover:text-white p-1 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {filteredProducts.length === 0 ? (
                  <div className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-6 text-center space-y-2.5">
                    <p className="text-sm font-bold text-white">
                      Nenhum produto cadastrado para este filtro ainda.
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      Apenas produtos oficialmente cadastrados pelos estabelecimentos na aba Perfil (Cardápio Estilo iFood) aparecem nesta vitrine.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection('profile');
                          setProfileSubTab('admin');
                        }}
                        className="px-4 py-2 rounded-xl bg-[#EA1D2C] hover:bg-[#D01725] text-white text-xs font-extrabold transition-colors"
                      >
                        Ir ao Perfil · Cadastrar Produtos (Cardápio iFood)
                      </button>

                      {(selectedCategory !== 'Todas' ||
                        selectedStoreFilter !== 'all' ||
                        searchQuery.trim() !== '') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory('Todas');
                            setSelectedStoreFilter('all');
                            setSearchQuery('');
                          }}
                          className="px-4 py-2 rounded-xl bg-[#0B0B0D] border border-[#26272B] text-[#F5A623] text-xs font-extrabold"
                        >
                          Limpar Filtros
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredProducts.map((product) => {
                      const qtyInCart = cartQuantities[product.id] || 0;
                      return (
                        <article
                          key={product.id}
                          className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-3.5 flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#2C2D33] bg-[#0B0B0D]">
                              <img
                                src={product.image}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F5A623]/15 text-[#F5A623]">
                                  {product.category}
                                </span>
                                <span className="text-[11px] text-[#9CA3AF] truncate">
                                  {product.storeName}
                                </span>
                              </div>

                              <h3 className="text-sm font-bold text-white leading-snug">
                                {product.name}
                              </h3>

                              <p className="text-xs text-[#9CA3AF] line-clamp-2">
                                {product.description}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-[#26272B] flex items-center justify-between gap-2">
                            <div>
                              <p className="text-base font-extrabold text-white font-mono-tabular">
                                R$ {product.price.toFixed(2)}
                              </p>
                              <p className="text-[11px] text-[#F5A623] font-mono-tabular">
                                ★ {product.reviewsCountLabel} · Grátis
                              </p>
                            </div>

                            {product.inStock ? (
                              <button
                                type="button"
                                onClick={() => handleAddToCart(product)}
                                aria-label={`Adicionar ${product.name}`}
                                className="px-4 py-2 rounded-xl bg-[#F5A623] hover:bg-[#F59E0B] text-[#0B0B0D] text-xs font-extrabold transition-colors flex items-center gap-1.5 min-h-[38px]"
                              >
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                                <span>
                                  {qtyInCart > 0
                                    ? `Adicionar (${qtyInCart})`
                                    : 'Adicionar'}
                                </span>
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-[#EF4444]">
                                Esgotado
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 2: BUSCAR & MAPA GPS EM TEMPO REAL */}
          {activeSection === 'search' && (
            <div className="space-y-6">
              <div className="relative">
                <Search className="w-5 h-5 text-[#9CA3AF] absolute left-4 top-1/2 -translate-y-1/2" />
                <label htmlFor="tab-search-input" className="sr-only">
                  Buscar tabacaria, cigarro, seda
                </label>
                <input
                  id="tab-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar tabacaria, cigarro, seda..."
                  className="w-full rounded-2xl bg-[#1A1B1E] border border-[#26272B] pl-11 pr-4 py-3 text-sm text-white placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#F5A623]"
                />
              </div>

              <GeoMapSection
                stores={stores}
                selectedStoreId={selectedMapStoreId}
                onSelectStore={setSelectedMapStoreId}
                userCoords={userCoords}
                userAddressLabel={userAddressLabel}
                onUpdateUserLocation={(coords, label) => {
                  setUserCoords(coords);
                  setUserAddressLabel(label);
                  setCheckoutAddress(`${label} - São Paulo`);
                  pushToast(
                    'Localização GPS Atualizada',
                    `Calculando tabacarias próximas a ${label}.`
                  );
                }}
                activeOrder={activeOrder}
                onFilterStoreCatalog={(storeId) => {
                  setSelectedStoreFilter(storeId);
                  setActiveSection('home');
                }}
                onSearchNearbyOpenTabacarias={handleSearchNearbyOpenTabacarias}
                isSearchingNetwork={isSearchingNetwork}
                onGoToProfileRegistration={() => {
                  setActiveSection('profile');
                  setProfileSubTab('admin');
                }}
              />
            </div>
          )}

          {/* TAB 3: PEDIDOS (Histórico de Pedidos, Recompra Rápida, Rastreio Ao Vivo & Avaliações) */}
          {activeSection === 'orders' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#26272B] pb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#F5A623]">
                      Rastreio em Tempo Real &amp; Histórico Persistente
                    </p>
                    <h2 className="text-xl font-extrabold text-white">
                      Meus Pedidos ({orders.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('search')}
                    className="text-xs font-bold text-[#F5A623] hover:underline"
                  >
                    Ver no Mapa GPS →
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-6 text-center space-y-3">
                    <p className="text-sm font-bold text-white">
                      Nenhum pedido realizado ainda.
                    </p>
                    <p className="text-xs text-[#9CA3AF]">
                      Adicione cigarros Marlboro, Camel, Kretek, Harmony ou sedas à sacola e escolha pagar na entrega (Pix, Dinheiro ou Cartão) para criar seu primeiro pedido real!
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSection('home')}
                      className="px-4 py-2 rounded-xl bg-[#F5A623] text-[#0B0B0D] text-xs font-extrabold"
                    >
                      Ver Catálogo de Cigarros &amp; Tabacarias
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((ord) => (
                      <div
                        key={ord.orderId}
                        className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-4 space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono-tabular font-bold text-[#F5A623]">
                            #{ord.orderId} · {ord.createdAt}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              ord.status === 'cancelled'
                                ? 'bg-[#3F1D1D] text-[#F87171]'
                                : 'bg-[#0E3A2F] text-[#4ADE80]'
                            }`}
                          >
                            {ord.status === 'confirmed' && 'Confirmado'}
                            {ord.status === 'preparing' && 'Em Preparo'}
                            {ord.status === 'delivering' && 'Em Rota (20-30 min)'}
                            {ord.status === 'delivered' && 'Entregue'}
                            {ord.status === 'cancelled' && 'Cancelado'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">{ord.storeName}</h3>
                        <p className="text-xs text-[#D1D5DB]">{ord.itemsSummary}</p>
                        <div className="pt-2 border-t border-[#26272B] flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[#9CA3AF] truncate max-w-[200px]">
                            {ord.deliveryAddress}
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="font-mono-tabular font-extrabold text-white">
                              R$ {ord.totalAmount.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleReorderPastOrder(ord)}
                              className="px-3 py-1.5 rounded-xl bg-[#F5A623] text-[#0B0B0D] font-extrabold flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Recomprar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <LoyaltyAndReviewsSection
                loyaltyPoints={loyaltyPoints}
                activeCouponCode={activeCoupon?.code || null}
                onRedeemReward={handleRedeemReward}
                onShareSocialBonus={() => setLoyaltyPoints((prev) => prev + 50)}
                stores={stores}
                reviews={reviews}
                onAddReview={handleAddReview}
                defaultAuthorName={checkoutCustomerName}
              />
            </div>
          )}

          {/* TAB 4: PERFIL (Login com Google, Dados Salvos, Clube Ifumo, Painel Admin Parceiro & Chat 24h) */}
          {activeSection === 'profile' && (
            <div className="space-y-5">
              {/* 1. GOOGLE LOGIN & SAVED USER PROFILE CARD */}
              <section
                aria-labelledby="google-account-heading"
                className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26272B] pb-4">
                  <div className="flex items-center gap-3">
                    {currentUser?.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={checkoutCustomerName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full border-2 border-[#F5A623] object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#24252A] border border-[#F5A623] flex items-center justify-center text-[#F5A623] font-extrabold text-lg shrink-0">
                        {checkoutCustomerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2
                          id="google-account-heading"
                          className="text-base font-extrabold text-white truncate"
                        >
                          {checkoutCustomerName}
                        </h2>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            currentUser
                              ? 'bg-[#0E3A2F] text-[#4ADE80]'
                              : 'bg-[#F5A623]/15 text-[#F5A623]'
                          }`}
                        >
                          {currentUser ? 'Google Conectado' : 'Conta Local'}
                        </span>
                      </div>
                      <p className="text-xs text-[#9CA3AF] truncate">
                        {currentUser?.email ||
                          'Conecte sua Conta Google para salvar seus dados na nuvem'}
                      </p>
                      <p className="text-xs text-[#F5A623] font-mono-tabular font-bold mt-0.5">
                        Clube {getLoyaltyTier(loyaltyPoints).tier} · {loyaltyPoints} pontos
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentUser ? (
                      <button
                        type="button"
                        onClick={() => signOut(auth)}
                        className="px-3.5 py-2.5 rounded-xl border border-[#26272B] bg-[#0B0B0D] hover:border-[#EF4444] text-xs font-bold text-white flex items-center gap-2 min-h-[40px]"
                      >
                        <LogOut className="w-4 h-4 text-[#EF4444]" />
                        <span>Sair da Conta Google</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-[#0B0B0D] text-xs font-extrabold flex items-center gap-2 shadow-md transition-colors min-h-[40px]"
                      >
                        <GoogleBadgeIcon className="w-4 h-4 shrink-0" />
                        <span>Entrar com Google</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSimulatedOffline((prev) => !prev)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 min-h-[40px] ${
                        simulatedOffline
                          ? 'border-[#F5A623] bg-[#F5A623]/20 text-[#F5A623]'
                          : 'border-[#26272B] bg-[#0B0B0D] text-[#D1D5DB]'
                      }`}
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      <span>{simulatedOffline ? 'Offline Ativo' : 'Modo Offline'}</span>
                    </button>
                  </div>
                </div>

                {/* FORMULÁRIO DE DADOS SALVOS DO USUÁRIO */}
                <form onSubmit={handleSaveUserProfile} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#F5A623]">
                      Minhas Informações Salvas (Entrega &amp; Checkout)
                    </h3>
                    <span className="text-[11px] text-[#9CA3AF]">
                      {currentUser ? 'Sincronizado no Firestore' : 'Salvo neste dispositivo & servidor'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="profile-name-input"
                        className="block text-xs font-semibold text-[#9CA3AF]"
                      >
                        Nome Completo (+18 anos)
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-[#F5A623] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="profile-name-input"
                          type="text"
                          value={checkoutCustomerName}
                          onChange={(e) => setCheckoutCustomerName(e.target.value)}
                          placeholder="Seu nome completo"
                          className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="profile-address-input"
                        className="block text-xs font-semibold text-[#9CA3AF]"
                      >
                        Endereço Padrão de Entrega
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-[#F5A623] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="profile-address-input"
                          type="text"
                          value={userAddressLabel}
                          onChange={(e) => {
                            setUserAddressLabel(e.target.value);
                            setCheckoutAddress(e.target.value);
                          }}
                          placeholder="Ex: Av. Paulista, 1000"
                          className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="profile-phone-input"
                        className="block text-xs font-semibold text-[#9CA3AF]"
                      >
                        WhatsApp / Telefone
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#F5A623] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="profile-phone-input"
                          type="tel"
                          value={userPhone}
                          onChange={(e) => setUserPhone(e.target.value)}
                          placeholder="(11) 99999-0000"
                          className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {profileSavedFeedback ? (
                      <p className="text-xs font-semibold text-[#4ADE80] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{profileSavedFeedback}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#9CA3AF]">
                        Seus dados preenchem automaticamente o endereço de entrega e o checkout Stripe.
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-4 py-2.5 rounded-xl bg-[#F5A623] hover:bg-[#F59E0B] text-[#0B0B0D] text-xs font-extrabold flex items-center gap-1.5 transition-colors ml-auto"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {isSavingProfile ? 'Salvando...' : 'Salvar Informações'}
                      </span>
                    </button>
                  </div>
                </form>
              </section>

              {/* Sub-navigation between Partner Admin (iFood Style) & Clube */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#1A1B1E] border border-[#26272B]">
                <button
                  type="button"
                  onClick={() => setProfileSubTab('admin')}
                  className={`py-2.5 rounded-xl text-xs font-extrabold transition-colors ${
                    profileSubTab === 'admin'
                      ? 'bg-[#EA1D2C] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  Cadastro Estabelecimento, Cardápio iFood &amp; Pedidos
                </button>
                <button
                  type="button"
                  onClick={() => setProfileSubTab('loyalty')}
                  className={`py-2.5 rounded-xl text-xs font-extrabold transition-colors ${
                    profileSubTab === 'loyalty'
                      ? 'bg-[#F5A623] text-[#0B0B0D]'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  Clube de Fidelidade &amp; Avaliações
                </button>
              </div>

              {profileSubTab === 'loyalty' ? (
                <LoyaltyAndReviewsSection
                  loyaltyPoints={loyaltyPoints}
                  activeCouponCode={activeCoupon?.code || null}
                  onRedeemReward={handleRedeemReward}
                  onShareSocialBonus={() => setLoyaltyPoints((prev) => prev + 50)}
                  stores={stores}
                  reviews={reviews}
                  onAddReview={handleAddReview}
                  defaultAuthorName={checkoutCustomerName}
                />
              ) : (
                <AdminAndSupportSection
                  orders={orders}
                  stores={stores}
                  products={products}
                  userCoords={userCoords}
                  onRegisterPlace={handleRegisterPlace}
                  onToggleStoreOpen={handleToggleStoreOpen}
                  onAdvanceOrderStatus={handleAdvanceOrderStatus}
                  onToggleProductStock={handleToggleProductStock}
                  onUpdateProductPrice={handleUpdateProductPrice}
                  onDeleteProduct={handleDeleteProduct}
                  onCreateProduct={handleCreateProduct}
                  onTriggerCustomPush={handleTriggerCustomPush}
                  supportMessages={supportMessages}
                  onSendSupportMessage={handleSendSupportMessage}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* SLIDE-OVER CART & STRIPE CHECKOUT DRAWER */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
        >
          <div className="w-full max-w-md bg-[#141518] border-l border-[#26272B] h-full flex flex-col justify-between overflow-y-auto p-5 text-white shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-[#26272B] pb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#F5A623]" />
                  <h2 id="cart-drawer-title" className="text-lg font-extrabold text-white">
                    Seu Carrinho &amp; Pagamento na Entrega
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  aria-label="Fechar carrinho"
                  className="p-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-[#1A1B1E]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cartItems.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-[#9CA3AF]">
                    Seu carrinho está vazio. Escolha cigarros Marlboro, Camel, Kretek, Harmony ou sedas.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      setActiveSection('home');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#F5A623] text-[#0B0B0D] text-xs font-extrabold"
                  >
                    Voltar às Tabacarias
                  </button>
                </div>
              ) : (
                <>
                  {/* Google Login Sync Banner inside Checkout */}
                  <div className="p-3 rounded-2xl bg-[#1A1B1E] border border-[#26272B] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {currentUser
                          ? `Conectado como ${currentUser.displayName || checkoutCustomerName}`
                          : 'Salve seus pedidos na sua Conta Google'}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] truncate">
                        {currentUser
                          ? 'Dados de entrega e pontos sincronizados na nuvem'
                          : 'Entre com Google para sincronizar endereço e pontos'}
                      </p>
                    </div>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="px-3 py-1.5 rounded-xl bg-white text-[#0B0B0D] text-xs font-extrabold flex items-center gap-1.5 shrink-0"
                      >
                        <GoogleBadgeIcon className="w-3.5 h-3.5" />
                        <span>Entrar</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {cartItems.map(({ product, quantity }) => (
                      <div
                        key={product.id}
                        className="p-3.5 rounded-2xl bg-[#1A1B1E] border border-[#26272B] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <img
                            src={product.image}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="w-11 h-11 rounded-lg object-cover border border-[#2C2D33] shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">
                              {product.name}
                            </p>
                            <p className="text-[11px] text-[#9CA3AF] font-mono-tabular">
                              R$ {product.price.toFixed(2)} un. · {product.storeName}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(product.id, -1)}
                            aria-label={`Diminuir quantidade de ${product.name}`}
                            className="w-8 h-8 rounded-lg bg-[#0B0B0D] border border-[#26272B] flex items-center justify-center text-white hover:border-[#F5A623]"
                          >
                            {quantity === 1 ? (
                              <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                            ) : (
                              <Minus className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="w-6 text-center text-xs font-mono-tabular font-bold">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(product.id, 1)}
                            aria-label={`Aumentar quantidade de ${product.name}`}
                            className="w-8 h-8 rounded-lg bg-[#0B0B0D] border border-[#26272B] flex items-center justify-center text-white hover:border-[#F5A623]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Coupon Code Input Row */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-[#F5A623] absolute left-3 top-1/2 -translate-y-1/2" />
                      <label htmlFor="coupon-code-input" className="sr-only">
                        Código de cupom promocional
                      </label>
                      <input
                        id="coupon-code-input"
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Cupom (ex: IFUMO30, IFUMO15)"
                        className="w-full rounded-xl bg-[#1A1B1E] border border-[#26272B] pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCouponCode}
                      className="px-3.5 py-2 rounded-xl bg-[#24252A] hover:bg-[#2E3036] text-xs font-bold text-[#F5A623] shrink-0"
                    >
                      Aplicar
                    </button>
                  </div>

                  <form id="stripe-checkout-form" onSubmit={handleStripeCheckout} className="space-y-4">
                    <div className="space-y-1">
                      <label htmlFor="checkout-name-input" className="block text-xs font-semibold text-[#9CA3AF]">
                        Nome do Recebedor (+18 anos)
                      </label>
                      <input
                        id="checkout-name-input"
                        type="text"
                        value={checkoutCustomerName}
                        onChange={(e) => setCheckoutCustomerName(e.target.value)}
                        className="w-full rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="checkout-address-input" className="block text-xs font-semibold text-[#9CA3AF]">
                        Endereço de Entrega (20-30 min)
                      </label>
                      <input
                        id="checkout-address-input"
                        type="text"
                        value={checkoutAddress}
                        onChange={(e) => setCheckoutAddress(e.target.value)}
                        className="w-full rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                      />
                    </div>

                    {/* PAGAMENTO SOMENTE NA ENTREGA (Escolhido para a Tabacaria / Motoboy) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="block text-xs font-extrabold uppercase tracking-wider text-[#F5A623]">
                          Pagamento na Entrega (Ao Motoboy)
                        </span>
                        <span className="text-[10px] font-semibold text-[#4ADE80]">
                          Pague só ao receber
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Escolha como deseja pagar diretamente ao entregador da tabacaria:
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('pix_entrega')}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-start gap-1 transition-colors text-left ${
                            paymentMethod === 'pix_entrega'
                              ? 'bg-[#F5A623]/15 border-[#F5A623] text-white'
                              : 'bg-[#1A1B1E] border-[#26272B] text-[#9CA3AF]'
                          }`}
                        >
                          <QrCode className="w-4 h-4 text-[#F5A623]" />
                          <span>Pix na Entrega</span>
                          <span className="text-[10px] font-normal text-[#9CA3AF]">
                            QR Code na maquininha
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('dinheiro_entrega')}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-start gap-1 transition-colors text-left ${
                            paymentMethod === 'dinheiro_entrega'
                              ? 'bg-[#F5A623]/15 border-[#F5A623] text-white'
                              : 'bg-[#1A1B1E] border-[#26272B] text-[#9CA3AF]'
                          }`}
                        >
                          <Banknote className="w-4 h-4 text-[#F5A623]" />
                          <span>Dinheiro</span>
                          <span className="text-[10px] font-normal text-[#9CA3AF]">
                            Espécie c/ troco
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cartao_credito_entrega')}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-start gap-1 transition-colors text-left ${
                            paymentMethod === 'cartao_credito_entrega'
                              ? 'bg-[#F5A623]/15 border-[#F5A623] text-white'
                              : 'bg-[#1A1B1E] border-[#26272B] text-[#9CA3AF]'
                          }`}
                        >
                          <CreditCard className="w-4 h-4 text-[#F5A623]" />
                          <span>Cartão de Crédito</span>
                          <span className="text-[10px] font-normal text-[#9CA3AF]">
                            Maquininha na entrega
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cartao_debito_entrega')}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-start gap-1 transition-colors text-left ${
                            paymentMethod === 'cartao_debito_entrega'
                              ? 'bg-[#F5A623]/15 border-[#F5A623] text-white'
                              : 'bg-[#1A1B1E] border-[#26272B] text-[#9CA3AF]'
                          }`}
                        >
                          <CreditCard className="w-4 h-4 text-[#F5A623]" />
                          <span>Cartão de Débito</span>
                          <span className="text-[10px] font-normal text-[#9CA3AF]">
                            Maquininha na entrega
                          </span>
                        </button>
                      </div>

                      {paymentMethod === 'dinheiro_entrega' && (
                        <div className="pt-1 space-y-1">
                          <label
                            htmlFor="checkout-change-input"
                            className="block text-[11px] font-semibold text-[#F5A623]"
                          >
                            Precisa de troco para quanto?
                          </label>
                          <input
                            id="checkout-change-input"
                            type="text"
                            value={changeFor}
                            onChange={(e) => setChangeFor(e.target.value)}
                            placeholder="Ex: R$ 50,00 ou Sem troco"
                            className="w-full rounded-xl bg-[#1A1B1E] border border-[#F5A623]/60 px-3 py-2 text-xs text-white focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {checkoutError && (
                      <p className="text-xs font-semibold text-[#EF4444]">{checkoutError}</p>
                    )}

                    <div className="p-4 rounded-2xl bg-[#1A1B1E] border border-[#26272B] space-y-2 text-xs font-mono-tabular">
                      <div className="flex justify-between text-[#9CA3AF]">
                        <span>Subtotal dos Itens</span>
                        <span>R$ {orderTotals.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[#4ADE80]">
                        <span>Entrega Expressa (20-30 min)</span>
                        <span>Grátis</span>
                      </div>
                      {orderTotals.discount > 0 && (
                        <div className="flex justify-between text-[#4ADE80] font-bold">
                          <span>Cupom ({activeCoupon?.code})</span>
                          <span>- R$ {orderTotals.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-[#26272B] flex justify-between text-sm font-extrabold text-white">
                        <span>Total a Pagar na Entrega</span>
                        <span>
                          R${' '}
                          {orderTotals.subtotal - orderTotals.discount > 0
                            ? (orderTotals.subtotal - orderTotals.discount).toFixed(2)
                            : orderTotals.total.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-[#F5A623]">
                        <span>Pontos Clube Ifumo</span>
                        <span>+{orderTotals.loyaltyEarned} pts</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessingStripe}
                      className="w-full py-3.5 rounded-2xl bg-[#F5A623] text-[#0B0B0D] text-sm font-extrabold hover:bg-[#F59E0B] transition-colors flex items-center justify-center gap-2 min-h-[48px]"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {isProcessingStripe
                          ? 'Confirmando Pedido na Tabacaria...'
                          : 'Confirmar Pedido (Pagar na Entrega)'}
                      </span>
                    </button>
                  </form>
                </>
              )}
            </div>

            <p className="text-[11px] text-[#6B7280] text-center pt-4">
              Pagamento realizado somente na entrega (Pix, Dinheiro ou Cartão) · Venda proibida para menores de 18 anos.
            </p>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR — Exact 4 Tabs from image_dc88fa52.png: Início, Buscar, Pedidos, Perfil */}
      <nav
        aria-label="Navegação Principal Mobile"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#121316]/95 backdrop-blur-md border-t border-[#232428]"
      >
        <div className="max-w-[480px] md:max-w-4xl mx-auto grid grid-cols-4 items-center h-16 px-2">
          <button
            type="button"
            onClick={() => setActiveSection('home')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeSection === 'home' ? 'text-[#F5A623]' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Home
              className={`w-5 h-5 ${
                activeSection === 'home' ? 'fill-[#F5A623] text-[#F5A623]' : ''
              }`}
            />
            <span className="text-[11px] font-semibold mt-1">Início</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('search')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeSection === 'search' ? 'text-[#F5A623]' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Search className="w-5 h-5" />
            <span className="text-[11px] font-medium mt-1">Buscar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('orders')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeSection === 'orders' ? 'text-[#F5A623]' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[11px] font-medium mt-1">Pedidos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeSection === 'profile' ? 'text-[#F5A623]' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[11px] font-medium mt-1">Perfil</span>
          </button>
        </div>
      </nav>

      {/* Offline Status Toast */}
      <OfflineIndicator simulatedOffline={simulatedOffline} />
    </div>
  );
}
