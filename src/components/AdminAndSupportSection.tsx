import React, { useState, useEffect } from 'react';
import {
  PackageCheck,
  BellRing,
  MessageSquare,
  Send,
  Store,
  PlusCircle,
  Download,
  XCircle,
  CheckCircle2,
  Truck,
  ChefHat,
  Trash2,
  MapPin,
  Navigation,
  Search,
  Tag,
  Image as ImageIcon,
  DollarSign,
  Power,
  Layers,
} from 'lucide-react';
import {
  OrderRecord,
  PartnerStore,
  ProductItem,
  SupportChatMessage,
  PRODUCT_PHOTO_GALLERY,
} from '../data/mockCatalog';
import {
  calculateAdminAnalytics,
  OrderStatus,
} from '../utils/commerceLogic';
import { PlaceRegistrationPayload } from './PlaceRegistrationModal';

interface AdminAndSupportSectionProps {
  orders: OrderRecord[];
  stores: PartnerStore[];
  products: ProductItem[];
  userCoords: { lat: number; lng: number };
  onRegisterPlace: (payload: PlaceRegistrationPayload) => Promise<void>;
  onToggleStoreOpen: (storeId: string, nextIsOpen: boolean) => Promise<void>;
  onAdvanceOrderStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onToggleProductStock: (productId: string) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onCreateProduct: (payload: {
    storeId: string;
    name: string;
    category: ProductItem['category'];
    price: number;
    description: string;
    origin?: string;
    image?: string;
  }) => Promise<void>;
  onTriggerCustomPush: (title: string, body: string) => void;
  supportMessages: SupportChatMessage[];
  onSendSupportMessage: (text: string, senderRole: 'customer' | 'support') => void;
}

type PartnerPortalTab = 'menu_ifood' | 'orders_manager' | 'store_registration' | 'support_push';

const MENU_CATEGORIES: ProductItem['category'][] = [
  'Cigarros',
  'Tabaco',
  'Charutos',
  'Seda',
  'Isqueiros',
  'Vape',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  confirmed: 'Novo · Confirmado',
  preparing: 'Em Preparo',
  delivering: 'Enviado · Saiu p/ Entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export function AdminAndSupportSection({
  orders,
  stores,
  products,
  userCoords,
  onRegisterPlace,
  onToggleStoreOpen,
  onAdvanceOrderStatus,
  onToggleProductStock,
  onUpdateProductPrice,
  onDeleteProduct,
  onCreateProduct,
  onTriggerCustomPush,
  supportMessages,
  onSendSupportMessage,
}: AdminAndSupportSectionProps) {
  // Default to establishment registration if no store is registered yet, otherwise iFood Menu
  const [activePortalTab, setActivePortalTab] = useState<PartnerPortalTab>(
    stores.length === 0 ? 'store_registration' : 'menu_ifood'
  );
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');

  // --- TAB 1: ESTABLISHMENT REGISTRATION STATE (Inside Profile) ---
  const [placeName, setPlaceName] = useState('');
  const [placeNeighborhood, setPlaceNeighborhood] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeLat, setPlaceLat] = useState<string>(String(userCoords.lat));
  const [placeLng, setPlaceLng] = useState<string>(String(userCoords.lng));
  const [placeSpecialty, setPlaceSpecialty] = useState(
    'Marlboro, Camel, Kretek, Harmony, Charutos, Sedas & Isqueiros'
  );
  const [placeEta, setPlaceEta] = useState('20-30 min');
  const [placeDeliveryLabel, setPlaceDeliveryLabel] = useState('Grátis');
  const [placeIsOpen, setPlaceIsOpen] = useState(true);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [isSubmittingPlace, setIsSubmittingPlace] = useState(false);
  const [placeFeedback, setPlaceFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // --- TAB 2: IFOOD-STYLE PRODUCT MENU MANAGER STATE ---
  const [newProdStoreId, setNewProdStoreId] = useState<string>(stores[0]?.id || '');
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdCategory, setNewProdCategory] =
    useState<ProductItem['category']>('Cigarros');
  const [newProdPrice, setNewProdPrice] = useState<string>('14.50');
  const [newProdOrigin, setNewProdOrigin] = useState<string>('Original Lacrado · 20 un.');
  const [newProdDesc, setNewProdDesc] = useState<string>('');
  const [newProdImage, setNewProdImage] = useState<string>(
    PRODUCT_PHOTO_GALLERY[0].image
  );
  const [newProdError, setNewProdError] = useState<string>('');
  const [newProdSuccess, setNewProdSuccess] = useState<string>('');
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('');
  const [editingPriceMap, setEditingPriceMap] = useState<Record<string, string>>({});

  // --- TAB 4: PUSH & SUPPORT CHAT STATE ---
  const [pushTitle, setPushTitle] = useState('Novos Cigarros & Sedas no Cardápio!');
  const [pushBody, setPushBody] = useState(
    'Peça agora pelo Ifumo com entrega expressa em até 30 min e pagamento na entrega.'
  );
  const [pushError, setPushError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatRole, setChatRole] = useState<'customer' | 'support'>('support');
  const [chatError, setChatError] = useState('');

  useEffect(() => {
    if (stores.length > 0 && (!newProdStoreId || !stores.some((s) => s.id === newProdStoreId))) {
      setNewProdStoreId(stores[0].id);
    }
  }, [stores, newProdStoreId]);

  const filteredOrders = orders.filter((o) => {
    if (selectedStoreFilter !== 'all' && o.storeId !== selectedStoreFilter) return false;
    if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
    return true;
  });

  const analytics = calculateAdminAnalytics(
    orders.map((o) => ({
      orderId: o.orderId,
      totalAmount: o.totalAmount,
      status: o.status,
      storeId: o.storeId,
    }))
  );

  const handleGeocodePlaceAddress = async () => {
    if (placeAddress.trim().length < 4) {
      setPlaceFeedback({
        type: 'error',
        text: 'Digite o endereço completo para buscar as coordenadas GPS.',
      });
      return;
    }
    setIsGeocodingAddress(true);
    setPlaceFeedback(null);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(placeAddress.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          setPlaceLat(String(Number(data.lat.toFixed(6))));
          setPlaceLng(String(Number(data.lng.toFixed(6))));
          setPlaceFeedback({
            type: 'success',
            text: `Coordenadas GPS localizadas (${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}).`,
          });
        }
      }
    } catch {
      setPlaceFeedback({
        type: 'error',
        text: 'Não foi possível geocodificar agora. Você pode informar a latitude/longitude manualmente.',
      });
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  const handleCaptureBrowserGps = () => {
    if (!('geolocation' in navigator)) {
      setPlaceFeedback({
        type: 'error',
        text: 'Geolocalização não suportada neste navegador.',
      });
      return;
    }
    setIsCapturingGps(true);
    setPlaceFeedback(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const currentLat = Number(pos.coords.latitude.toFixed(6));
        const currentLng = Number(pos.coords.longitude.toFixed(6));
        setPlaceLat(String(currentLat));
        setPlaceLng(String(currentLng));
        try {
          const res = await fetch(`/api/geocode?lat=${currentLat}&lng=${currentLng}`);
          if (res.ok) {
            const data = await res.json();
            if (data.label && !placeAddress.trim()) {
              setPlaceAddress(data.label);
            }
          }
        } catch {
          // Ignore reverse geocode error
        }
        setIsCapturingGps(false);
        setPlaceFeedback({
          type: 'success',
          text: `GPS atual capturado (${currentLat}, ${currentLng}).`,
        });
      },
      () => {
        setIsCapturingGps(false);
        setPlaceFeedback({
          type: 'error',
          text: 'Permissão de GPS negada. Use o botão Geocodificar Endereço.',
        });
      },
      { timeout: 6000 }
    );
  };

  const handleRegisterPlaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (placeName.trim().length < 2) {
      setPlaceFeedback({
        type: 'error',
        text: 'Informe o nome do estabelecimento (mínimo 2 caracteres).',
      });
      return;
    }
    if (placeAddress.trim().length < 5) {
      setPlaceFeedback({
        type: 'error',
        text: 'Informe o endereço completo do estabelecimento.',
      });
      return;
    }

    setIsSubmittingPlace(true);
    setPlaceFeedback(null);
    try {
      await onRegisterPlace({
        name: placeName.trim(),
        neighborhood: placeNeighborhood.trim() || 'Centro',
        address: placeAddress.trim(),
        lat: Number(placeLat) || userCoords.lat,
        lng: Number(placeLng) || userCoords.lng,
        specialty:
          placeSpecialty.trim() ||
          'Cigarros, Tabaco, Charutos, Seda, Isqueiros & Vape',
        etaRangeLabel: placeEta.trim() || '20-30 min',
        deliveryLabel: placeDeliveryLabel.trim() || 'Grátis',
        prepMinutes: 8,
        isOpen: placeIsOpen,
        seedCatalog: false,
      });
      setPlaceName('');
      setPlaceNeighborhood('');
      setPlaceAddress('');
      setPlaceFeedback({
        type: 'success',
        text: 'Estabelecimento cadastrado com sucesso! Agora cadastre seus produtos na aba "Cardápio iFood (Produtos)".',
      });
    } catch (err) {
      setPlaceFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao cadastrar estabelecimento.',
      });
    } finally {
      setIsSubmittingPlace(false);
    }
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewProdError('');
    setNewProdSuccess('');

    if (stores.length === 0) {
      setNewProdError(
        'Cadastre seu estabelecimento primeiro na aba "1. Meu Estabelecimento" antes de adicionar produtos.'
      );
      return;
    }

    const targetStoreId = newProdStoreId || stores[0].id;
    const trimmedName = newProdName.trim();
    const numericPrice = Number(newProdPrice.replace(',', '.'));

    if (trimmedName.length < 2) {
      setNewProdError('Informe o nome do produto (mínimo 2 caracteres).');
      return;
    }
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      setNewProdError('Informe um preço válido em R$.');
      return;
    }

    setIsSavingProduct(true);
    try {
      await onCreateProduct({
        storeId: targetStoreId,
        name: trimmedName,
        category: newProdCategory,
        price: numericPrice,
        origin: newProdOrigin.trim() || 'Original Lacrado',
        image: newProdImage.trim() || PRODUCT_PHOTO_GALLERY[0].image,
        description:
          newProdDesc.trim() ||
          `Disponível em ${
            stores.find((s) => s.id === targetStoreId)?.name || 'nossa tabacaria'
          } com pagamento na entrega.`,
      });
      setNewProdName('');
      setNewProdDesc('');
      setNewProdSuccess(`Produto "${trimmedName}" adicionado ao cardápio com sucesso!`);
    } catch (err) {
      setNewProdError(
        err instanceof Error ? err.message : 'Erro ao cadastrar produto.'
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleExportCsvReport = () => {
    const header = [
      'ID Pedido',
      'Cliente',
      'Estabelecimento',
      'Itens',
      'Total (BRL)',
      'Pagamento',
      'Protocolo Entrega',
      'Status',
      'Horario',
    ];
    const rows = filteredOrders.map((o) => [
      o.orderId,
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.storeName.replace(/"/g, '""')}"`,
      `"${o.itemsSummary.replace(/"/g, '""')}"`,
      o.totalAmount.toFixed(2),
      o.paymentMethod,
      o.stripeTxId,
      o.status,
      `"${o.createdAt}"`,
    ]);
    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio-ifumo-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendPush = (e: React.FormEvent) => {
    e.preventDefault();
    if (pushTitle.trim().length < 3 || pushBody.trim().length < 5) {
      setPushError('Preencha o título e a mensagem da notificação push.');
      return;
    }
    setPushError('');
    onTriggerCustomPush(pushTitle.trim(), pushBody.trim());
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim().length < 2) {
      setChatError('Digite uma mensagem válida para enviar ao chat.');
      return;
    }
    setChatError('');
    onSendSupportMessage(chatInput.trim(), chatRole);
    setChatInput('');
  };

  // Filter products for the iFood-style menu manager
  const storeFilteredProducts = products.filter((p) => {
    if (selectedStoreFilter !== 'all' && p.storeId !== selectedStoreFilter) {
      return false;
    }
    if (menuSearchQuery.trim()) {
      const q = menuSearchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.storeName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* HEADER DO PORTAL DO PARCEIRO (ESTILO GESTOR IFOOD) */}
      <section
        aria-labelledby="admin-heading"
        className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26272B] pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EA1D2C]/20 border border-[#EA1D2C]/40 text-[#FF6B78] text-[10px] font-extrabold uppercase tracking-wider">
              Portal do Parceiro · Estilo iFood
            </span>
            <h2
              id="admin-heading"
              className="text-lg sm:text-xl font-extrabold text-white mt-1"
            >
              Cadastro de Estabelecimento, Cardápio &amp; Gestor de Pedidos
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              Cadastre sua tabacaria, publique produtos no cardápio por categoria e passe pedidos para Enviado ou Entregue.
            </p>
          </div>

          {stores.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <Store className="w-4 h-4 text-[#F5A623]" />
              <label htmlFor="admin-store-filter" className="sr-only">
                Selecionar estabelecimento cadastrado
              </label>
              <select
                id="admin-store-filter"
                value={selectedStoreFilter}
                onChange={(e) => {
                  setSelectedStoreFilter(e.target.value);
                  if (e.target.value !== 'all') {
                    setNewProdStoreId(e.target.value);
                  }
                }}
                className="rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#F5A623]"
              >
                <option value="all">Todos os Estabelecimentos ({stores.length})</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.isOpen ? 'Aberto' : 'Fechado'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 4 ABAS ADMINISTRATIVAS DO ESTABELECIMENTO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setActivePortalTab('store_registration')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors border ${
              activePortalTab === 'store_registration'
                ? 'bg-[#F5A623] text-[#0B0B0D] border-[#F5A623]'
                : 'bg-[#0B0B0D] text-[#D1D5DB] border-[#26272B] hover:border-[#F5A623]/50'
            }`}
          >
            <Store className="w-4 h-4 shrink-0" />
            <span>1. Cadastrar Loja ({stores.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePortalTab('menu_ifood')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors border ${
              activePortalTab === 'menu_ifood'
                ? 'bg-[#EA1D2C] text-white border-[#EA1D2C]'
                : 'bg-[#0B0B0D] text-[#D1D5DB] border-[#26272B] hover:border-[#EA1D2C]/50'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span>2. Cardápio iFood ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePortalTab('orders_manager')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors border ${
              activePortalTab === 'orders_manager'
                ? 'bg-[#F5A623] text-[#0B0B0D] border-[#F5A623]'
                : 'bg-[#0B0B0D] text-[#D1D5DB] border-[#26272B] hover:border-[#F5A623]/50'
            }`}
          >
            <PackageCheck className="w-4 h-4 shrink-0" />
            <span>3. Pedidos ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePortalTab('support_push')}
            className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors border ${
              activePortalTab === 'support_push'
                ? 'bg-[#F5A623] text-[#0B0B0D] border-[#F5A623]'
                : 'bg-[#0B0B0D] text-[#D1D5DB] border-[#26272B] hover:border-[#F5A623]/50'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>4. Chat &amp; Push</span>
          </button>
        </div>
      </section>

      {/* =====================================================================
          ABA 1: CADASTRO DO ESTABELECIMENTO (EXCLUSIVO NO PERFIL)
         ===================================================================== */}
      {activePortalTab === 'store_registration' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleRegisterPlaceSubmit}
            className="lg:col-span-7 rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#26272B] pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#F5A623]" />
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Cadastrar Estabelecimento na Plataforma
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Apenas estabelecimentos cadastrados aqui aparecem em "Lojas perto de você" e no Mapa GPS.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="profile-place-name"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Nome da Tabacaria / Estabelecimento *
                </label>
                <input
                  id="profile-place-name"
                  type="text"
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                  placeholder="Ex: Tabacaria Paulista 24h"
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-place-neighborhood"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Bairro / Região *
                </label>
                <input
                  id="profile-place-neighborhood"
                  type="text"
                  value={placeNeighborhood}
                  onChange={(e) => setPlaceNeighborhood(e.target.value)}
                  placeholder="Ex: Bela Vista · São Paulo"
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-place-address"
                className="block text-xs font-semibold text-[#9CA3AF] mb-1"
              >
                Endereço Completo do Estabelecimento *
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="profile-place-address"
                  type="text"
                  value={placeAddress}
                  onChange={(e) => setPlaceAddress(e.target.value)}
                  placeholder="Ex: Av. Brigadeiro Luís Antônio, 2050 - Bela Vista, São Paulo"
                  className="flex-1 rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
                <button
                  type="button"
                  onClick={handleGeocodePlaceAddress}
                  disabled={isGeocodingAddress}
                  className="px-3.5 py-2.5 rounded-xl bg-[#0B0B0D] border border-[#F5A623]/60 text-xs font-bold text-[#F5A623] hover:bg-[#F5A623]/15 transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {isGeocodingAddress ? 'Buscando GPS...' : 'Geocodificar'}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <div>
                <label
                  htmlFor="profile-place-lat"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Latitude GPS
                </label>
                <input
                  id="profile-place-lat"
                  type="text"
                  value={placeLat}
                  onChange={(e) => setPlaceLat(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-place-lng"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Longitude GPS
                </label>
                <input
                  id="profile-place-lng"
                  type="text"
                  value={placeLng}
                  onChange={(e) => setPlaceLng(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
              <button
                type="button"
                onClick={handleCaptureBrowserGps}
                disabled={isCapturingGps}
                className="py-2 px-3 rounded-xl bg-[#0B0B0D] border border-[#26272B] hover:border-[#F5A623] text-xs font-bold text-white flex items-center justify-center gap-1.5 min-h-[38px]"
              >
                <Navigation className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>{isCapturingGps ? 'Capturando...' : 'Usar Meu GPS'}</span>
              </button>
            </div>

            <div>
              <label
                htmlFor="profile-place-specialty"
                className="block text-xs font-semibold text-[#9CA3AF] mb-1"
              >
                Especialidade do Estabelecimento
              </label>
              <input
                id="profile-place-specialty"
                type="text"
                value={placeSpecialty}
                onChange={(e) => setPlaceSpecialty(e.target.value)}
                className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="profile-place-eta"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Tempo de Entrega
                </label>
                <input
                  id="profile-place-eta"
                  type="text"
                  value={placeEta}
                  onChange={(e) => setPlaceEta(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-place-delivery"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Taxa de Entrega
                </label>
                <input
                  id="profile-place-delivery"
                  type="text"
                  value={placeDeliveryLabel}
                  onChange={(e) => setPlaceDeliveryLabel(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
              <div>
                <span className="block text-xs font-semibold text-[#9CA3AF] mb-1">
                  Status Inicial
                </span>
                <button
                  type="button"
                  onClick={() => setPlaceIsOpen((prev) => !prev)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 min-h-[38px] ${
                    placeIsOpen
                      ? 'bg-[#0E3A2F] border-[#22C55E]/50 text-[#4ADE80]'
                      : 'bg-[#3F1D1D] border-[#EF4444]/50 text-[#F87171]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      placeIsOpen ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                    }`}
                  />
                  <span>{placeIsOpen ? 'Aberto Agora' : 'Fechado'}</span>
                </button>
              </div>
            </div>

            {placeFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  placeFeedback.type === 'success'
                    ? 'bg-[#0E3A2F]/60 border-[#22C55E]/40 text-[#4ADE80]'
                    : 'bg-[#3F1D1D]/60 border-[#EF4444]/40 text-[#F87171]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{placeFeedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingPlace}
              className="w-full py-3 rounded-xl bg-[#F5A623] hover:bg-[#F59E0B] text-[#0B0B0D] text-xs font-extrabold transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {isSubmittingPlace
                  ? 'Salvando Estabelecimento...'
                  : 'Concluir Cadastro do Estabelecimento'}
              </span>
            </button>
          </form>

          {/* Lista de Estabelecimentos Cadastrados na Plataforma */}
          <div className="lg:col-span-5 rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#26272B] pb-3">
              <h3 className="text-sm font-extrabold text-white">
                Estabelecimentos Cadastrados ({stores.length})
              </h3>
              <span className="text-[11px] text-[#9CA3AF]">Plataforma Oficial</span>
            </div>

            {stores.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#0B0B0D] border border-[#26272B] text-center space-y-2">
                <Store className="w-7 h-7 text-[#F5A623] mx-auto" />
                <p className="text-xs font-bold text-white">
                  Nenhum estabelecimento cadastrado ainda.
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  Preencha o formulário ao lado para registrar sua tabacaria. Assim que cadastrada, você poderá incluir seus produtos na aba Cardápio iFood.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {stores.map((st) => {
                  const storeProductsCount = products.filter(
                    (p) => p.storeId === st.id
                  ).length;
                  return (
                    <div
                      key={st.id}
                      className="p-3.5 rounded-xl bg-[#0B0B0D] border border-[#26272B] space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-white truncate">
                            {st.name}
                          </p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">
                            {st.address} · {st.neighborhood}
                          </p>
                          <p className="text-[10px] text-[#F5A623] font-mono-tabular mt-0.5">
                            {storeProductsCount} produtos cadastrados no cardápio
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => onToggleStoreOpen(st.id, !st.isOpen)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 ${
                            st.isOpen
                              ? 'bg-[#0E3A2F] text-[#4ADE80]'
                              : 'bg-[#3F1D1D] text-[#F87171]'
                          }`}
                        >
                          {st.isOpen ? 'Aberto' : 'Fechado'}
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F2025]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStoreFilter(st.id);
                            setNewProdStoreId(st.id);
                            setActivePortalTab('menu_ifood');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#EA1D2C] hover:bg-[#D01725] text-white text-[11px] font-extrabold transition-colors"
                        >
                          Gerenciar Cardápio iFood →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          ABA 2: CARDÁPIO ESTILO IFOOD (CADASTRO E GESTÃO DE PRODUTOS)
         ===================================================================== */}
      {activePortalTab === 'menu_ifood' && (
        <section className="space-y-5">
          {stores.length === 0 ? (
            <div className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-6 text-center space-y-3">
              <Store className="w-8 h-8 text-[#F5A623] mx-auto" />
              <h3 className="text-base font-extrabold text-white">
                Cadastre seu Estabelecimento Primeiro
              </h3>
              <p className="text-xs text-[#9CA3AF] max-w-md mx-auto">
                Para cadastrar produtos no Cardápio Estilo iFood, primeiro registre os dados da sua tabacaria na aba "1. Cadastrar Loja".
              </p>
              <button
                type="button"
                onClick={() => setActivePortalTab('store_registration')}
                className="px-5 py-2.5 rounded-xl bg-[#F5A623] text-[#0B0B0D] text-xs font-extrabold"
              >
                Ir para Cadastro de Estabelecimento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Coluna Esquerda: Formulário de Cadastro de Item no Cardápio iFood */}
              <div className="lg:col-span-5 rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#26272B] pb-3">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-[#EA1D2C]" />
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        Adicionar Item ao Cardápio
                      </h3>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Portal do Parceiro · Publicação imediata na loja
                      </p>
                    </div>
                  </div>
                </div>

                {/* Galeria Rápida de Fotos Reais (1 Clique preenche imagem e sugestão) */}
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#F5A623]">
                    Modelos Rápidos com Foto Real (1 Clique):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {PRODUCT_PHOTO_GALLERY.map((preset) => {
                      const isSelected = newProdImage === preset.image;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setNewProdImage(preset.image);
                            setNewProdCategory(preset.category);
                            if (!newProdName.trim()) {
                              setNewProdName(preset.suggestedName);
                            }
                            setNewProdPrice(preset.suggestedPrice);
                            setNewProdOrigin(preset.suggestedOrigin);
                          }}
                          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                            isSelected
                              ? 'bg-[#EA1D2C]/15 border-[#EA1D2C] text-white'
                              : 'bg-[#0B0B0D] border-[#26272B] text-[#D1D5DB] hover:border-[#F5A623]/50'
                          }`}
                        >
                          <img
                            src={preset.image}
                            alt={preset.label}
                            className="w-9 h-9 rounded-lg object-cover shrink-0 border border-[#2C2D33]"
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold truncate">
                              {preset.label}
                            </p>
                            <p className="text-[10px] text-[#F5A623] font-mono-tabular">
                              R$ {preset.suggestedPrice}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={handleCreateProductSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="new-prod-store"
                        className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                      >
                        Estabelecimento *
                      </label>
                      <select
                        id="new-prod-store"
                        value={newProdStoreId}
                        onChange={(e) => setNewProdStoreId(e.target.value)}
                        className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-[#F5A623]"
                      >
                        {stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="new-prod-cat"
                        className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                      >
                        Categoria do Cardápio *
                      </label>
                      <select
                        id="new-prod-cat"
                        value={newProdCategory}
                        onChange={(e) =>
                          setNewProdCategory(
                            e.target.value as ProductItem['category']
                          )
                        }
                        className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-[#F5A623]"
                      >
                        {MENU_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="new-prod-name"
                      className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                    >
                      Nome do Produto no Cardápio *
                    </label>
                    <input
                      id="new-prod-name"
                      type="text"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      placeholder="Ex: Marlboro Red King Size (Maço 20 un.)"
                      className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="new-prod-price"
                        className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                      >
                        Preço de Venda (R$) *
                      </label>
                      <div className="relative">
                        <DollarSign className="w-3.5 h-3.5 text-[#F5A623] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="new-prod-price"
                          type="text"
                          value={newProdPrice}
                          onChange={(e) => setNewProdPrice(e.target.value)}
                          placeholder="14.50"
                          className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] pl-8 pr-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#F5A623]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="new-prod-origin"
                        className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                      >
                        Detalhe / Embalagem
                      </label>
                      <div className="relative">
                        <Tag className="w-3.5 h-3.5 text-[#F5A623] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="new-prod-origin"
                          type="text"
                          value={newProdOrigin}
                          onChange={(e) => setNewProdOrigin(e.target.value)}
                          placeholder="Maço 20 un. Lacrado"
                          className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="new-prod-image"
                      className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                    >
                      Foto do Produto (URL ou Modelo Selecionado)
                    </label>
                    <div className="relative">
                      <ImageIcon className="w-3.5 h-3.5 text-[#F5A623] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="new-prod-image"
                        type="text"
                        value={newProdImage}
                        onChange={(e) => setNewProdImage(e.target.value)}
                        placeholder="/src/assets/images/..."
                        className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="new-prod-desc"
                      className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                    >
                      Descrição no Cardápio iFood
                    </label>
                    <input
                      id="new-prod-desc"
                      type="text"
                      value={newProdDesc}
                      onChange={(e) => setNewProdDesc(e.target.value)}
                      placeholder="Ex: Maço original lacrado com entrega expressa e pagamento na entrega."
                      className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                    />
                  </div>

                  {newProdError && (
                    <p className="text-xs font-semibold text-[#EF4444]">
                      {newProdError}
                    </p>
                  )}
                  {newProdSuccess && (
                    <p className="text-xs font-semibold text-[#4ADE80] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{newProdSuccess}</span>
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingProduct}
                    className="w-full py-3 rounded-xl bg-[#EA1D2C] hover:bg-[#D01725] text-white text-xs font-extrabold transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>
                      {isSavingProduct
                        ? 'Salvando no Cardápio...'
                        : 'Salvar Item no Cardápio iFood'}
                    </span>
                  </button>
                </form>
              </div>

              {/* Coluna Direita: Gestor de Cardápio Agrupado por Categorias (Igual ao iFood) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        Cardápio Cadastrado por Categoria ({storeFilteredProducts.length}{' '}
                        itens)
                      </h3>
                      <p className="text-xs text-[#9CA3AF]">
                        Ative ou pause itens com 1 clique, edite preços ou adicione novos produtos em cada categoria.
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <label htmlFor="ifood-menu-search" className="sr-only">
                      Buscar item cadastrado no cardápio
                    </label>
                    <input
                      id="ifood-menu-search"
                      type="search"
                      value={menuSearchQuery}
                      onChange={(e) => setMenuSearchQuery(e.target.value)}
                      placeholder="Buscar produto cadastrado no cardápio..."
                      className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] pl-10 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#EA1D2C]"
                    />
                  </div>
                </div>

                {/* Categorias Estilo iFood */}
                <div className="space-y-3">
                  {MENU_CATEGORIES.map((categoryName) => {
                    const itemsInCategory = storeFilteredProducts.filter(
                      (p) => p.category === categoryName
                    );
                    const activeCount = itemsInCategory.filter((i) => i.inStock).length;

                    return (
                      <div
                        key={categoryName}
                        className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] overflow-hidden"
                      >
                        {/* Cabeçalho da Categoria iFood */}
                        <div className="px-4 py-3 bg-[#141518] border-b border-[#26272B] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-white">
                              {categoryName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#26272B] text-[10px] font-bold text-[#D1D5DB]">
                              {itemsInCategory.length} itens ({activeCount} ativos)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setNewProdCategory(categoryName);
                              const inputEl = document.getElementById('new-prod-name');
                              inputEl?.focus();
                            }}
                            className="text-xs font-extrabold text-[#EA1D2C] hover:underline flex items-center gap-1"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>+ Adicionar em {categoryName}</span>
                          </button>
                        </div>

                        {/* Lista de Produtos da Categoria */}
                        {itemsInCategory.length === 0 ? (
                          <div className="p-4 text-center text-xs text-[#9CA3AF]">
                            Nenhum item cadastrado em <strong className="text-white">{categoryName}</strong>. Use o formulário ao lado para adicionar.
                          </div>
                        ) : (
                          <div className="divide-y divide-[#26272B]">
                            {itemsInCategory.map((prod) => {
                              const draftPrice =
                                editingPriceMap[prod.id] !== undefined
                                  ? editingPriceMap[prod.id]
                                  : prod.price.toFixed(2);

                              return (
                                <div
                                  key={prod.id}
                                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#16171B] transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <img
                                      src={prod.image}
                                      alt={prod.name}
                                      referrerPolicy="no-referrer"
                                      className={`w-14 h-14 rounded-xl object-cover border border-[#2C2D33] shrink-0 ${
                                        !prod.inStock ? 'opacity-40 grayscale' : ''
                                      }`}
                                    />
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-extrabold text-white truncate">
                                          {prod.name}
                                        </p>
                                      </div>
                                      <p className="text-[11px] text-[#9CA3AF] line-clamp-1">
                                        {prod.description}
                                      </p>
                                      <p className="text-[10px] text-[#F5A623] font-semibold">
                                        Loja: {prod.storeName} · {prod.origin}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Controles Estilo iFood: Preço Editável + Botão Ativo/Pausado + Excluir */}
                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <div className="flex items-center bg-[#0B0B0D] border border-[#26272B] rounded-xl px-2.5 py-1.5">
                                      <span className="text-[10px] font-bold text-[#9CA3AF] mr-1">
                                        R$
                                      </span>
                                      <input
                                        type="text"
                                        aria-label={`Preço de ${prod.name}`}
                                        value={draftPrice}
                                        onChange={(e) =>
                                          setEditingPriceMap((prev) => ({
                                            ...prev,
                                            [prod.id]: e.target.value,
                                          }))
                                        }
                                        onBlur={() => {
                                          const parsed = Number(
                                            String(draftPrice).replace(',', '.')
                                          );
                                          if (
                                            !Number.isNaN(parsed) &&
                                            parsed > 0 &&
                                            parsed !== prod.price
                                          ) {
                                            onUpdateProductPrice(prod.id, parsed);
                                          }
                                        }}
                                        className="w-16 text-xs font-mono-tabular font-extrabold text-white bg-transparent focus:outline-none"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => onToggleProductStock(prod.id)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                                        prod.inStock
                                          ? 'bg-[#0E3A2F] text-[#4ADE80] border border-[#22C55E]/40'
                                          : 'bg-[#3F1D1D] text-[#F87171] border border-[#EF4444]/40'
                                      }`}
                                    >
                                      <Power className="w-3.5 h-3.5" />
                                      <span>{prod.inStock ? 'Ativo' : 'Pausado'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => onDeleteProduct(prod.id)}
                                      aria-label={`Excluir ${prod.name}`}
                                      className="p-2 rounded-xl bg-[#0B0B0D] border border-[#26272B] text-[#9CA3AF] hover:text-[#EF4444] hover:border-[#EF4444] transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          ABA 3: GESTOR DE PEDIDOS (ACOMPANHAR, ENVIADO & ENTREGUE)
         ===================================================================== */}
      {activePortalTab === 'orders_manager' && (
        <section className="space-y-5">
          {/* 4 Performance KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-[#1A1B1E] border border-[#26272B] space-y-1">
              <p className="text-[11px] font-semibold text-[#9CA3AF]">
                Receita Total de Pedidos
              </p>
              <p className="text-xl font-extrabold text-white font-mono-tabular">
                R$ {analytics.totalRevenue.toFixed(2)}
              </p>
              <p className="text-[11px] font-semibold text-[#4ADE80]">
                Pagamento na Entrega
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#1A1B1E] border border-[#26272B] space-y-1">
              <p className="text-[11px] font-semibold text-[#9CA3AF]">Ticket Médio</p>
              <p className="text-xl font-extrabold text-[#F5A623] font-mono-tabular">
                R$ {analytics.averageTicket.toFixed(2)}
              </p>
              <p className="text-[11px] text-[#9CA3AF]">
                {orders.length} pedidos totais
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#1A1B1E] border border-[#26272B] space-y-1">
              <p className="text-[11px] font-semibold text-[#9CA3AF]">
                Pedidos em Andamento
              </p>
              <p className="text-xl font-extrabold text-white font-mono-tabular">
                {analytics.activeOrdersCount}
              </p>
              <p className="text-[11px] text-[#9CA3AF]">Sincronizados em Tempo Real</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#1A1B1E] border border-[#26272B] space-y-1">
              <p className="text-[11px] font-semibold text-[#9CA3AF]">
                Taxa de Conclusão
              </p>
              <p className="text-xl font-extrabold text-[#4ADE80] font-mono-tabular">
                {analytics.completionRatePercent}%
              </p>
              <p className="text-[11px] text-[#9CA3AF]">Entrega Expressa</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#26272B] pb-4">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-[#F5A623]" />
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Gestor de Pedidos em Tempo Real ({filteredOrders.length})
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Acompanhe novos pedidos e mude o status para Em Preparo, Enviado ou Entregue
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportCsvReport}
                className="px-3.5 py-2 rounded-xl bg-[#0B0B0D] border border-[#26272B] hover:border-[#F5A623] text-xs font-bold text-[#F5A623] flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </div>

            {/* Filtros de Status do Gestor de Pedidos */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: `Todos (${orders.length})` },
                { id: 'confirmed', label: 'Novos' },
                { id: 'preparing', label: 'Em Preparo' },
                { id: 'delivering', label: 'Enviados (Em Rota)' },
                { id: 'delivered', label: 'Entregues' },
                { id: 'cancelled', label: 'Cancelados' },
              ].map((stTab) => (
                <button
                  key={stTab.id}
                  type="button"
                  onClick={() => setOrderStatusFilter(stTab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    orderStatusFilter === stTab.id
                      ? 'bg-[#F5A623] text-[#0B0B0D]'
                      : 'bg-[#0B0B0D] text-[#9CA3AF] border border-[#26272B]'
                  }`}
                >
                  {stTab.label}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#0B0B0D] border border-[#26272B] text-center space-y-2">
                <p className="text-xs font-bold text-white">
                  Nenhum pedido encontrado para este filtro.
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  Quando um cliente realizar um pedido nos seus produtos cadastrados, ele aparecerá aqui instantaneamente para você passar para Enviado ou Entregue.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((ord) => (
                  <div
                    key={ord.orderId}
                    className="p-4 rounded-2xl bg-[#0B0B0D] border border-[#26272B] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono-tabular font-extrabold text-[#F5A623]">
                          #{ord.orderId}
                        </span>
                        <span className="text-[#4B5563]">·</span>
                        <span className="font-bold text-white">{ord.customerName}</span>
                        <span className="text-[#4B5563]">·</span>
                        <span className="text-[#9CA3AF]">{ord.storeName}</span>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                          ord.status === 'cancelled'
                            ? 'bg-[#3F1D1D] text-[#F87171]'
                            : ord.status === 'delivered'
                            ? 'bg-[#0E3A2F] text-[#4ADE80]'
                            : 'bg-[#F5A623]/20 text-[#F5A623]'
                        }`}
                      >
                        {STATUS_LABELS[ord.status]}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p className="text-white font-semibold">{ord.itemsSummary}</p>
                      <p className="text-[#9CA3AF]">
                        Endereço de Entrega: <strong className="text-[#D1D5DB]">{ord.deliveryAddress}</strong>
                      </p>
                      <p className="text-[#F5A623] font-mono-tabular font-bold">
                        Total: R$ {ord.totalAmount.toFixed(2)} · Pagamento na Entrega ({ord.stripeTxId})
                      </p>
                    </div>

                    {/* Botões Diretos de Despacho do Pedido (Preparo -> Enviado -> Entregue) */}
                    <div className="pt-3 border-t border-[#1F2025] flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={ord.status === 'preparing'}
                        onClick={() => onAdvanceOrderStatus(ord.orderId, 'preparing')}
                        className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                          ord.status === 'preparing'
                            ? 'bg-[#26272B] text-[#6B7280] cursor-not-allowed'
                            : 'bg-[#1A1B1E] hover:bg-[#24252A] border border-[#F5A623]/50 text-[#F5A623]'
                        }`}
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Em Preparo</span>
                      </button>

                      <button
                        type="button"
                        disabled={ord.status === 'delivering'}
                        onClick={() => onAdvanceOrderStatus(ord.orderId, 'delivering')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                          ord.status === 'delivering'
                            ? 'bg-[#26272B] text-[#6B7280] cursor-not-allowed'
                            : 'bg-[#F5A623] hover:bg-[#F59E0B] text-[#0B0B0D]'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Passar para Enviado</span>
                      </button>

                      <button
                        type="button"
                        disabled={ord.status === 'delivered'}
                        onClick={() => onAdvanceOrderStatus(ord.orderId, 'delivered')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors ${
                          ord.status === 'delivered'
                            ? 'bg-[#26272B] text-[#6B7280] cursor-not-allowed'
                            : 'bg-[#22C55E] hover:bg-[#16A34A] text-[#0B0B0D]'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Passar para Entregue</span>
                      </button>

                      {ord.status !== 'cancelled' && ord.status !== 'delivered' && (
                        <button
                          type="button"
                          onClick={() => onAdvanceOrderStatus(ord.orderId, 'cancelled')}
                          className="px-3 py-2 rounded-xl bg-[#1A1B1E] border border-[#26272B] hover:border-[#EF4444] text-xs font-bold text-[#EF4444] flex items-center gap-1 ml-auto"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancelar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          ABA 4: SUPORTE 24H & DISPARO DE NOTIFICAÇÕES PUSH
         ===================================================================== */}
      {activePortalTab === 'support_push' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-5 rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-[#F5A623]" />
              <h3 className="text-base font-extrabold text-white">
                Disparo de Notificação Push em Tempo Real
              </h3>
            </div>

            <form onSubmit={handleSendPush} className="space-y-3">
              <div>
                <label
                  htmlFor="push-title-input"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Título do Alerta Push
                </label>
                <input
                  id="push-title-input"
                  type="text"
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
              <div>
                <label
                  htmlFor="push-body-input"
                  className="block text-xs font-semibold text-[#9CA3AF] mb-1"
                >
                  Mensagem Promocional ou Status
                </label>
                <input
                  id="push-body-input"
                  type="text"
                  value={pushBody}
                  onChange={(e) => setPushBody(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
              {pushError && (
                <p className="text-xs font-semibold text-[#EF4444]">{pushError}</p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#F5A623] text-[#0B0B0D] text-xs font-extrabold hover:bg-[#F59E0B] transition-colors min-h-[42px]"
              >
                Disparar Push Agora
              </button>
            </form>
          </div>

          <section
            aria-labelledby="support-chat-heading"
            className="lg:col-span-7 rounded-2xl bg-[#1A1B1E] border border-[#26272B] p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#26272B] pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#F5A623]" />
                <div>
                  <h2 id="support-chat-heading" className="text-base font-extrabold text-white">
                    Chat Interno de Suporte 24h
                  </h2>
                  <p className="text-xs text-[#9CA3AF]">
                    Canal direto em tempo real entre cliente, entregador e estabelecimento
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setChatRole('customer')}
                  className={`px-3 py-1.5 rounded-lg font-bold ${
                    chatRole === 'customer'
                      ? 'bg-[#F5A623] text-[#0B0B0D]'
                      : 'bg-[#0B0B0D] text-[#9CA3AF] border border-[#26272B]'
                  }`}
                >
                  Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setChatRole('support')}
                  className={`px-3 py-1.5 rounded-lg font-bold ${
                    chatRole === 'support'
                      ? 'bg-[#F5A623] text-[#0B0B0D]'
                      : 'bg-[#0B0B0D] text-[#9CA3AF] border border-[#26272B]'
                  }`}
                >
                  Estabelecimento
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {supportMessages.length === 0 ? (
                <div className="p-5 rounded-2xl bg-[#0B0B0D] border border-[#26272B] text-center">
                  <p className="text-xs text-[#9CA3AF]">
                    Nenhuma mensagem no histórico. Envie uma mensagem abaixo para iniciar o atendimento.
                  </p>
                </div>
              ) : (
                supportMessages.map((msg) => {
                  const isSupport = msg.senderRole === 'support';
                  return (
                    <div
                      key={msg.messageId}
                      className={`p-3.5 rounded-2xl border text-xs max-w-xl ${
                        isSupport
                          ? 'bg-[#0B0B0D] border-[#F5A623]/40 text-white'
                          : 'bg-[#121316] border-[#26272B] text-white ml-auto'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1 text-[11px] text-[#9CA3AF]">
                        <span className="font-bold text-[#F5A623]">{msg.senderName}</span>
                        <span className="font-mono-tabular">{msg.createdAt}</span>
                      </div>
                      <p className="leading-relaxed text-[#E5E7EB]">{msg.text}</p>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <label htmlFor="support-chat-input" className="sr-only">
                Digite sua mensagem
              </label>
              <input
                id="support-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Digite uma mensagem para o cliente ou entregador..."
                className="flex-1 rounded-xl bg-[#0B0B0D] border border-[#26272B] px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623] min-h-[42px]"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#F5A623] text-[#0B0B0D] text-xs font-extrabold hover:bg-[#F59E0B] transition-colors flex items-center justify-center gap-1.5 min-h-[42px] shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar</span>
              </button>
            </form>
            {chatError && (
              <p className="text-xs font-semibold text-[#EF4444]">{chatError}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
