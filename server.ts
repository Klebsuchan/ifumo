import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import {
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_REVIEWS,
  INITIAL_SUPPORT_MESSAGES,
  PARTNER_STORES,
  ProductItem,
  OrderRecord,
  StoreReview,
  SupportChatMessage,
  PartnerStore,
} from './src/data/mockCatalog';
import { OrderStatus } from './src/utils/commerceLogic';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SavedUserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  defaultAddress: string;
  phone: string;
  loyaltyPoints: number;
  tier: string;
  role: 'customer' | 'partner' | 'admin';
  updatedAt: string;
}

interface PersistedDatabase {
  users: Record<string, SavedUserProfile>;
  stores: PartnerStore[];
  products: ProductItem[];
  orders: OrderRecord[];
  reviews: StoreReview[];
  supportMessages: SupportChatMessage[];
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    timestamp: string;
  }>;
}

const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'ifumo-db.json');

function loadDatabase(): PersistedDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedDatabase>;
      if (parsed.products && parsed.orders && parsed.stores) {
        return {
          users: parsed.users || {},
          stores: parsed.stores,
          products: parsed.products,
          orders: parsed.orders,
          reviews: parsed.reviews || [],
          supportMessages: parsed.supportMessages || [],
          notifications: parsed.notifications || [],
        };
      }
    }
  } catch (err) {
    console.warn('Database init notice, seeding fresh state:', err);
  }

  const initialDb: PersistedDatabase = {
    users: {},
    stores: PARTNER_STORES,
    products: INITIAL_PRODUCTS,
    orders: [],
    reviews: [],
    supportMessages: [],
    notifications: [],
  };
  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(dbState: PersistedDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Database write error:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const dbState = loadDatabase();

  // Connected SSE clients for real-time updates
  const sseClients = new Set<express.Response>();

  function broadcastEvent(event: string, payload: unknown) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(message);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  app.use(express.json());

  // 1. Health & API Status
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Ifumo Real-Time Commerce & Payment Engine',
      stripeConfigured: Boolean(
        process.env.STRIPE_SECRET_KEY &&
          !process.env.STRIPE_SECRET_KEY.includes('placeholder')
      ),
      counts: {
        users: Object.keys(dbState.users).length,
        stores: dbState.stores.length,
        products: dbState.products.length,
        orders: dbState.orders.length,
        reviews: dbState.reviews.length,
      },
    });
  });

  // 2. Full Persisted State Endpoint
  app.get('/api/state', (_req, res) => {
    res.json(dbState);
  });

  // 2b. User Profile Persistence Endpoints (Synced with Google Login & Firestore)
  app.get('/api/users/:uid', (req, res) => {
    const { uid } = req.params;
    const profile = dbState.users[uid];
    if (!profile) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }
    return res.json({ success: true, profile });
  });

  app.put('/api/users/:uid', (req, res) => {
    const { uid } = req.params;
    const {
      displayName,
      email,
      photoURL,
      defaultAddress,
      phone,
      loyaltyPoints,
      tier,
      role,
    } = req.body;

    const existing = dbState.users[uid];
    const savedProfile: SavedUserProfile = {
      uid: String(uid).slice(0, 128),
      displayName: String(displayName || existing?.displayName || 'Cliente Ifumo').trim().slice(0, 80),
      email: String(email || existing?.email || '').trim().slice(0, 120),
      photoURL: String(photoURL || existing?.photoURL || '').trim().slice(0, 300),
      defaultAddress: String(defaultAddress || existing?.defaultAddress || 'Av. Paulista, 1000').trim().slice(0, 240),
      phone: String(phone || existing?.phone || '(11) 99999-0000').trim().slice(0, 30),
      loyaltyPoints: typeof loyaltyPoints === 'number' ? loyaltyPoints : (existing?.loyaltyPoints ?? 420),
      tier: String(tier || existing?.tier || 'Prata').slice(0, 20),
      role: (role as SavedUserProfile['role']) || existing?.role || 'customer',
      updatedAt: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    dbState.users[uid] = savedProfile;
    saveDatabase(dbState);
    broadcastEvent('user_profile_updated', { profile: savedProfile });

    return res.json({ success: true, profile: savedProfile });
  });

  // 3. Server-Sent Events (SSE) Real-Time Stream
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // 4. Real Geocoding & Address Search (OpenStreetMap Nominatim + Local Fallback)
  app.get('/api/geocode', async (req, res) => {
    const addressQuery = String(req.query.q || '').trim();
    const latParam = req.query.lat ? Number(req.query.lat) : null;
    const lngParam = req.query.lng ? Number(req.query.lng) : null;

    try {
      if (latParam !== null && lngParam !== null && !Number.isNaN(latParam) && !Number.isNaN(lngParam)) {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latParam}&lon=${lngParam}&zoom=18&addressdetails=1`,
          { headers: { 'User-Agent': 'IfumoDeliveryApp/1.0' } }
        );
        if (response.ok) {
          const data = await response.json();
          const road = data.address?.road || data.address?.suburb || 'Endereço GPS';
          const houseNumber = data.address?.house_number ? `, ${data.address.house_number}` : '';
          const suburb = data.address?.suburb || data.address?.neighbourhood || 'São Paulo';
          return res.json({
            label: `${road}${houseNumber} · ${suburb}`,
            lat: latParam,
            lng: lngParam,
          });
        }
      } else if (addressQuery.length >= 3) {
        const encoded = encodeURIComponent(`${addressQuery}, São Paulo, Brasil`);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`,
          { headers: { 'User-Agent': 'IfumoDeliveryApp/1.0' } }
        );
        if (response.ok) {
          const results = await response.json();
          if (Array.isArray(results) && results.length > 0) {
            return res.json({
              label: addressQuery,
              lat: Number(results[0].lat),
              lng: Number(results[0].lon),
            });
          }
        }
      }
    } catch {
      // Fallback to deterministic São Paulo coordinates if external network is restricted
    }

    return res.json({
      label: addressQuery || 'Av. Paulista, 1000',
      lat: latParam ?? -23.5649,
      lng: lngParam ?? -46.652,
    });
  });

  // 4b. Search Open Tabacarias Near User Coordinates (Strictly Platform-Registered Establishments)
  app.get('/api/tabacarias/nearby', async (req, res) => {
    const queryText = String(req.query.q || '').trim().toLowerCase();
    const openOnly = req.query.openOnly !== 'false';

    const filteredStores = dbState.stores.filter((s) => {
      if (openOnly && !s.isOpen) return false;
      if (!queryText) return true;
      return (
        s.name.toLowerCase().includes(queryText) ||
        s.neighborhood.toLowerCase().includes(queryText) ||
        s.specialty.toLowerCase().includes(queryText) ||
        s.address.toLowerCase().includes(queryText)
      );
    });

    const registeredStoreIds = new Set(dbState.stores.map((s) => s.id));
    const registeredProducts = dbState.products.filter((p) =>
      registeredStoreIds.has(p.storeId)
    );

    return res.json({
      success: true,
      discoveredCount: filteredStores.length,
      stores: filteredStores,
      products: registeredProducts,
    });
  });

  // 4c. Real Place / Tabacaria Registration (Cadastro de Lugares)
  app.post('/api/stores', async (req, res) => {
    try {
      const {
        id,
        ownerId,
        name,
        neighborhood,
        address,
        lat,
        lng,
        prepMinutes,
        etaRangeLabel,
        deliveryLabel,
        specialty,
        isOpen,
        seedCatalog,
      } = req.body;

      const cleanName = String(name || '').trim();
      const cleanAddress = String(address || '').trim();
      if (cleanName.length < 2 || cleanAddress.length < 5) {
        return res
          .status(400)
          .json({ error: 'Informe o nome do lugar e o endereço completo.' });
      }

      let resolvedLat = Number(lat);
      let resolvedLng = Number(lng);
      let resolvedNeighborhood = String(neighborhood || '').trim();

      // Automatically geocode the address if coordinates were not explicitly provided
      if (
        Number.isNaN(resolvedLat) ||
        Number.isNaN(resolvedLng) ||
        (resolvedLat === 0 && resolvedLng === 0)
      ) {
        try {
          const encoded = encodeURIComponent(`${cleanAddress}, Brasil`);
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&addressdetails=1`,
            { headers: { 'User-Agent': 'IfumoDeliveryApp/1.0' } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (Array.isArray(geoData) && geoData.length > 0) {
              resolvedLat = Number(geoData[0].lat);
              resolvedLng = Number(geoData[0].lon);
              if (!resolvedNeighborhood) {
                resolvedNeighborhood =
                  geoData[0].address?.suburb ||
                  geoData[0].address?.neighbourhood ||
                  geoData[0].address?.city_district ||
                  'Centro';
              }
            }
          }
        } catch {
          // Use fallback São Paulo coordinates if offline
        }
      }

      if (Number.isNaN(resolvedLat) || resolvedLat === 0) resolvedLat = -23.5649;
      if (Number.isNaN(resolvedLng) || resolvedLng === 0) resolvedLng = -46.652;
      if (!resolvedNeighborhood) resolvedNeighborhood = 'Região Central';

      const spriteChoices = [
        '54 824 164 124',
        '54 984 164 124',
        '54 1144 164 124',
        '54 1304 164 124',
      ];
      const spriteViewBox =
        spriteChoices[dbState.stores.length % spriteChoices.length];

      const storeId =
        id && /^[a-zA-Z0-9_\-]+$/.test(String(id))
          ? String(id).slice(0, 120)
          : `place_${Date.now().toString(36)}`;

      const newStore: PartnerStore = {
        id: storeId,
        ownerId: String(ownerId || 'user_registered').slice(0, 128),
        name: cleanName.slice(0, 80),
        neighborhood: resolvedNeighborhood.slice(0, 80),
        address: cleanAddress.slice(0, 240),
        lat: Number(resolvedLat.toFixed(6)),
        lng: Number(resolvedLng.toFixed(6)),
        rating: 5.0,
        reviewCount: 1,
        reviewCountFormatted: 'Novo',
        prepMinutes: Math.min(180, Math.max(1, Number(prepMinutes) || 8)),
        etaRangeLabel: String(etaRangeLabel || '20-30 min').slice(0, 30),
        deliveryLabel: String(deliveryLabel || 'Grátis').slice(0, 30),
        specialty: String(
          specialty ||
            'Marlboro, Camel, Kretek, Harmony, Charutos, Sedas & Isqueiros'
        ).slice(0, 200),
        isOpen: isOpen !== false,
        spriteViewBox,
      };

      const existingIdx = dbState.stores.findIndex((s) => s.id === newStore.id);
      if (existingIdx >= 0) {
        dbState.stores[existingIdx] = newStore;
      } else {
        dbState.stores = [newStore, ...dbState.stores];
      }

      // Produtos só aparecem quando cadastrados explicitamente pelo estabelecimento no Cardápio iFood
      const createdProducts: ProductItem[] = [];

      const notif = {
        id: `notif_place_${Date.now()}`,
        title: `Novo Lugar Cadastrado: ${newStore.name}`,
        body: `${newStore.address} (${newStore.neighborhood}) agora está ativo no mapa e catálogo!`,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      dbState.notifications = [notif, ...dbState.notifications.slice(0, 9)];
      saveDatabase(dbState);

      broadcastEvent('store_created', {
        store: newStore,
        stores: dbState.stores,
        products: dbState.products,
        notification: notif,
      });

      return res.json({
        success: true,
        store: newStore,
        stores: dbState.stores,
        products: dbState.products,
        createdProductsCount: createdProducts.length,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao cadastrar lugar';
      return res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/stores/:storeId', (req, res) => {
    const { storeId } = req.params;
    const idx = dbState.stores.findIndex((s) => s.id === storeId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado.' });
    }

    const current = dbState.stores[idx];
    const updated: PartnerStore = {
      ...current,
      name: req.body.name ? String(req.body.name).trim().slice(0, 80) : current.name,
      neighborhood: req.body.neighborhood
        ? String(req.body.neighborhood).trim().slice(0, 80)
        : current.neighborhood,
      address: req.body.address
        ? String(req.body.address).trim().slice(0, 240)
        : current.address,
      specialty: req.body.specialty
        ? String(req.body.specialty).trim().slice(0, 200)
        : current.specialty,
      etaRangeLabel: req.body.etaRangeLabel
        ? String(req.body.etaRangeLabel).trim().slice(0, 30)
        : current.etaRangeLabel,
      deliveryLabel: req.body.deliveryLabel
        ? String(req.body.deliveryLabel).trim().slice(0, 30)
        : current.deliveryLabel,
      isOpen:
        typeof req.body.isOpen === 'boolean' ? req.body.isOpen : current.isOpen,
    };

    dbState.stores[idx] = updated;
    saveDatabase(dbState);
    broadcastEvent('store_updated', { store: updated, stores: dbState.stores });

    return res.json({
      success: true,
      store: updated,
      stores: dbState.stores,
    });
  });

  // 5. Order Checkout (Payment on Delivery: Pix, Cash, Credit or Debit Card)
  app.post('/api/checkout/stripe', async (req, res) => {
    try {
      const {
        items,
        totalAmount,
        deliveryFee,
        paymentMethod,
        changeFor,
        customerName,
        deliveryAddress,
        storeId,
        storeName,
        userId,
        loyaltyEarned,
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Carrinho vazio.' });
      }

      const methodLabels: Record<string, string> = {
        pix_entrega: 'PIX_NA_ENTREGA',
        dinheiro_entrega: changeFor
          ? `DINHEIRO_TROCO_PARA_${String(changeFor).replace(/\D/g, '') || '50'}`
          : 'DINHEIRO_SEM_TROCO',
        cartao_credito_entrega: 'CARTAO_CREDITO_MAQUININHA',
        cartao_debito_entrega: 'CARTAO_DEBITO_MAQUININHA',
      };

      const selectedMethod = paymentMethod || 'pix_entrega';
      const deliveryProtocol =
        methodLabels[selectedMethod] || `ENTREGA_${Date.now().toString(36)}`;

      const newOrderId = `ord_ifumo_${Math.floor(1000 + Math.random() * 9000)}`;
      const itemsSummary = items
        .map((i: { quantity: number; name: string }) => `${i.quantity}x ${i.name}`)
        .join(', ')
        .slice(0, 490);

      const fallbackStore = dbState.stores.find((s) => s.id === storeId) || dbState.stores[0];
      const newOrder: OrderRecord = {
        orderId: newOrderId,
        userId: String(userId || 'demo_user_1'),
        customerName: String(customerName || 'Cliente Ifumo').slice(0, 80),
        storeId: String(storeId || fallbackStore?.id || 'store_registered'),
        storeName: String(storeName || fallbackStore?.name || 'Estabelecimento Parceiro').slice(0, 80),
        itemsSummary,
        totalAmount: Number(Number(totalAmount || 0).toFixed(2)),
        deliveryFee: Number(Number(deliveryFee || 0).toFixed(2)),
        paymentMethod: selectedMethod,
        stripeTxId: deliveryProtocol.slice(0, 110),
        deliveryAddress: String(deliveryAddress || 'Av. Paulista, 1000').slice(0, 240),
        status: 'confirmed',
        loyaltyEarned: Number(loyaltyEarned || Math.max(5, Math.round(Number(totalAmount || 0) * 1.5))),
        createdAt: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      dbState.orders = [newOrder, ...dbState.orders];

      const notif = {
        id: `notif_${Date.now()}`,
        title: `Pedido #${newOrderId} Confirmado (Pagar na Entrega)`,
        body: `${newOrder.storeName} recebeu seu pedido. O entregador levará maquininha/Pix/troco em 20-30 min!`,
        timestamp: newOrder.createdAt,
      };
      dbState.notifications = [notif, ...dbState.notifications.slice(0, 9)];
      saveDatabase(dbState);

      broadcastEvent('order_created', { order: newOrder, notification: notif });

      return res.json({
        success: true,
        mode: 'payment_on_delivery',
        transactionId: deliveryProtocol,
        order: newOrder,
        status: 'confirmed',
        amountBrl: newOrder.totalAmount,
        paymentMethod: newOrder.paymentMethod,
        receiptNumber: `IFM-${Date.now().toString().slice(-6)}`,
        processedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar pedido';
      return res.status(500).json({ error: message });
    }
  });

  // 6. Order Status Update (Partner Admin or Customer Cancel)
  app.patch('/api/orders/:orderId/status', (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body as { status: OrderStatus };
    const validStatuses: OrderStatus[] = [
      'confirmed',
      'preparing',
      'delivering',
      'delivered',
      'cancelled',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }

    const orderIndex = dbState.orders.findIndex((o) => o.orderId === orderId);
    if (orderIndex === -1) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    dbState.orders[orderIndex] = {
      ...dbState.orders[orderIndex],
      status,
    };

    const statusLabels: Record<OrderStatus, string> = {
      confirmed: 'Confirmado',
      preparing: 'Em Preparo na Tabacaria',
      delivering: 'Motoboy Saiu para Entrega (20-30 min)',
      delivered: 'Pedido Entregue com Sucesso',
      cancelled: 'Pedido Cancelado',
    };

    const notif = {
      id: `notif_${Date.now()}`,
      title: `Pedido #${orderId} · ${statusLabels[status]}`,
      body: `${dbState.orders[orderIndex].storeName}: ${statusLabels[status]}.`,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    dbState.notifications = [notif, ...dbState.notifications.slice(0, 9)];
    saveDatabase(dbState);

    broadcastEvent('order_updated', {
      order: dbState.orders[orderIndex],
      notification: notif,
    });

    return res.json({
      success: true,
      order: dbState.orders[orderIndex],
      notification: notif,
    });
  });

  // 7. Create New Product (Partner Admin — Cardápio iFood Style)
  app.post('/api/products', (req, res) => {
    const {
      id,
      storeId,
      storeName,
      name,
      category,
      price,
      description,
      origin,
      intensity,
      image,
      tagLabel,
    } = req.body;
    if (!name || String(name).trim().length < 2 || Number(price) <= 0) {
      return res
        .status(400)
        .json({ error: 'Informe nome e preço válido para o produto.' });
    }

    const store = dbState.stores.find((s) => s.id === storeId) || dbState.stores[0];
    if (!store && !storeId) {
      return res.status(400).json({
        error: 'Cadastre seu estabelecimento primeiro na aba Meu Estabelecimento.',
      });
    }

    const categorySpriteMap: Record<string, string> = {
      Cigarros: '42 578 108 108',
      Tabaco: '185 578 108 108',
      Charutos: '327 578 108 108',
      Seda: '468 578 108 108',
      Isqueiros: '609 578 108 108',
      Vape: '742 578 108 108',
    };

    const defaultCategoryImages: Record<string, string> = {
      Cigarros: '/src/assets/images/cig_marlboro_pack_1794927241031.jpg',
      Tabaco: '/src/assets/images/product_rolling_kit_1794919025601.jpg',
      Charutos: '/src/assets/images/product_cigars_habanos_1794919023985.jpg',
      Seda: '/src/assets/images/product_rolling_kit_1794919025601.jpg',
      Isqueiros: '/src/assets/images/product_rolling_kit_1794919025601.jpg',
      Vape: '/src/assets/images/product_hookah_narguile_1794919025135.jpg',
    };

    const resolvedCategory = (category as ProductItem['category']) || 'Cigarros';
    const resolvedId =
      id && /^[a-zA-Z0-9_\-]+$/.test(String(id))
        ? String(id).slice(0, 120)
        : `prod_${Date.now().toString(36)}`;

    const newProduct: ProductItem = {
      id: resolvedId,
      storeId: store ? store.id : String(storeId).slice(0, 120),
      storeName: store ? store.name : String(storeName || 'Estabelecimento').slice(0, 80),
      name: String(name).trim().slice(0, 90),
      category: resolvedCategory,
      tagLabel: String(tagLabel || 'PRONTA ENTREGA').slice(0, 30),
      description: String(
        description || 'Produto cadastrado na plataforma com entrega expressa em até 30 min.'
      ).slice(0, 200),
      origin: String(origin || 'Original Lacrado').slice(0, 40),
      intensity: String(intensity || 'Pronta Entrega').slice(0, 40),
      rating: 5.0,
      reviewsCountLabel: '5.0 (Verificado)',
      price: Number(Number(price).toFixed(2)),
      image: String(
        image || defaultCategoryImages[resolvedCategory] || '/src/assets/images/cig_marlboro_pack_1794927241031.jpg'
      ).slice(0, 300),
      spriteViewBox: categorySpriteMap[resolvedCategory] || '42 578 108 108',
      inStock: true,
    };

    dbState.products = [newProduct, ...dbState.products.filter((p) => p.id !== newProduct.id)];
    saveDatabase(dbState);
    broadcastEvent('product_created', { product: newProduct });

    return res.json({ success: true, product: newProduct });
  });

  // 8. Toggle Stock or Update Product Details (Partner Admin — Cardápio iFood Style)
  app.patch('/api/products/:productId', (req, res) => {
    const { productId } = req.params;
    const { inStock, price, name, description, category, image } = req.body;

    const idx = dbState.products.findIndex((p) => p.id === productId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    dbState.products[idx] = {
      ...dbState.products[idx],
      inStock: typeof inStock === 'boolean' ? inStock : dbState.products[idx].inStock,
      price:
        typeof price === 'number' && price > 0
          ? Number(price.toFixed(2))
          : dbState.products[idx].price,
      name: name ? String(name).trim().slice(0, 90) : dbState.products[idx].name,
      description: description
        ? String(description).trim().slice(0, 200)
        : dbState.products[idx].description,
      category: category
        ? (category as ProductItem['category'])
        : dbState.products[idx].category,
      image: image ? String(image).trim().slice(0, 300) : dbState.products[idx].image,
    };

    saveDatabase(dbState);
    broadcastEvent('product_updated', { product: dbState.products[idx] });

    return res.json({ success: true, product: dbState.products[idx] });
  });

  // 8b. Delete Product from Cardápio iFood
  app.delete('/api/products/:productId', (req, res) => {
    const { productId } = req.params;
    const exists = dbState.products.some((p) => p.id === productId);
    if (!exists) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    dbState.products = dbState.products.filter((p) => p.id !== productId);
    saveDatabase(dbState);
    broadcastEvent('product_deleted', { productId });
    return res.json({ success: true, productId });
  });

  // 9. Create Store Review & Dynamically Recalculate Store Rating
  app.post('/api/reviews', (req, res) => {
    const { storeId, rating, comment, authorName, userId } = req.body;
    const storeIdx = dbState.stores.findIndex((s) => s.id === storeId);
    const store = storeIdx >= 0 ? dbState.stores[storeIdx] : dbState.stores[0];

    const numericRating = Math.min(5, Math.max(1, Number(rating || 5)));
    const newReview: StoreReview = {
      reviewId: `rev_${Date.now().toString(36)}`,
      userId: String(userId || 'demo_user_1'),
      authorName: String(authorName || 'Cliente Ifumo').slice(0, 80),
      storeId: store.id,
      storeName: store.name,
      rating: numericRating,
      comment: String(comment || '').slice(0, 600),
      createdAt: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    dbState.reviews = [newReview, ...dbState.reviews];

    // Recalculate store rating and reviewCount
    if (storeIdx >= 0) {
      const prevCount = dbState.stores[storeIdx].reviewCount;
      const prevRating = dbState.stores[storeIdx].rating;
      const nextCount = prevCount + 1;
      const nextRating = Number(
        ((prevRating * prevCount + numericRating) / nextCount).toFixed(1)
      );
      dbState.stores[storeIdx] = {
        ...dbState.stores[storeIdx],
        rating: nextRating,
        reviewCount: nextCount,
        reviewCountFormatted: nextCount.toLocaleString('pt-BR'),
      };
    }

    saveDatabase(dbState);
    broadcastEvent('review_created', {
      review: newReview,
      stores: dbState.stores,
    });

    return res.json({
      success: true,
      review: newReview,
      stores: dbState.stores,
    });
  });

  // 10. Support Chat Message Persistence & Intelligent Concierge Reply
  app.post('/api/support/messages', (req, res) => {
    const { text, senderRole, senderName, userId } = req.body;
    if (!text || String(text).trim().length < 1) {
      return res.status(400).json({ error: 'Mensagem vazia.' });
    }

    const nowTime = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newMsg: SupportChatMessage = {
      messageId: `msg_${Date.now().toString(36)}`,
      userId: String(userId || 'demo_user_1'),
      senderName: String(
        senderName || (senderRole === 'support' ? 'Suporte Ifumo 24h' : 'Cliente Ifumo')
      ).slice(0, 80),
      senderRole: senderRole === 'support' ? 'support' : 'customer',
      text: String(text).trim().slice(0, 500),
      createdAt: nowTime,
    };

    dbState.supportMessages = [...dbState.supportMessages, newMsg];
    saveDatabase(dbState);
    broadcastEvent('support_message', { message: newMsg });

    return res.json({ success: true, message: newMsg });
  });

  // 11. Real-Time Push Notification Dispatcher
  app.post('/api/notifications/push', (req, res) => {
    const { title, body, segment, targetOrderId } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
    }

    const notif = {
      id: `push_${Date.now().toString(36)}`,
      title: String(title).slice(0, 100),
      body: String(body).slice(0, 240),
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    dbState.notifications = [notif, ...dbState.notifications.slice(0, 9)];
    saveDatabase(dbState);
    broadcastEvent('push_notification', notif);

    return res.json({
      success: true,
      notificationId: notif.id,
      title: notif.title,
      body: notif.body,
      segment: segment || 'all_active_users',
      targetOrderId: targetOrderId || null,
      dispatchedAt: new Date().toISOString(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ifumo Server running on http://localhost:${PORT}`);
  });
}

startServer();
