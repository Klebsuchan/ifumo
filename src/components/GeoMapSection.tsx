import React, { useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  Clock,
  ShieldCheck,
  Truck,
  Search,
  Radar,
  Store,
} from 'lucide-react';
import { PartnerStore, OrderRecord } from '../data/mockCatalog';
import { calculateDistanceKm, estimateDeliveryMinutes } from '../utils/commerceLogic';

interface GeoMapSectionProps {
  stores: PartnerStore[];
  selectedStoreId: string;
  onSelectStore: (storeId: string) => void;
  userCoords: { lat: number; lng: number };
  userAddressLabel: string;
  onUpdateUserLocation: (coords: { lat: number; lng: number }, label: string) => void;
  activeOrder: OrderRecord | null;
  onFilterStoreCatalog: (storeId: string) => void;
  onSearchNearbyOpenTabacarias: (queryText?: string) => Promise<void>;
  isSearchingNetwork: boolean;
  onGoToProfileRegistration: () => void;
}

const PRESET_LOCATIONS = [
  {
    label: 'Av. Paulista, 1000',
    lat: -23.5649,
    lng: -46.652,
  },
  {
    label: 'Al. Lorena, 1420 · Jardins',
    lat: -23.5614,
    lng: -46.6658,
  },
  {
    label: 'Av. Brigadeiro Faria Lima, 3477 · Itaim',
    lat: -23.5868,
    lng: -46.6822,
  },
  {
    label: 'Rua dos Pinheiros, 498 · Pinheiros',
    lat: -23.5652,
    lng: -46.6805,
  },
];

export function GeoMapSection({
  stores,
  selectedStoreId,
  onSelectStore,
  userCoords,
  userAddressLabel,
  onUpdateUserLocation,
  activeOrder,
  onFilterStoreCatalog,
  onSearchNearbyOpenTabacarias,
  isSearchingNetwork,
  onGoToProfileRegistration,
}: GeoMapSectionProps) {
  const [infoOpenStoreId, setInfoOpenStoreId] = useState<string | null>(selectedStoreId);
  const [locatingGps, setLocatingGps] = useState(false);
  const [networkQuery, setNetworkQuery] = useState('');
  const [onlyOpenFilter, setOnlyOpenFilter] = useState(true);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  // Apenas estabelecimentos cadastrados dentro da plataforma aparecem no mapa
  const registeredStores = React.useMemo(() => {
    const q = networkQuery.trim().toLowerCase();
    return stores
      .filter((s) => (!onlyOpenFilter ? true : s.isOpen))
      .filter((s) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.neighborhood.toLowerCase().includes(q) ||
          s.specialty.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const distA = calculateDistanceKm(userCoords.lat, userCoords.lng, a.lat, a.lng);
        const distB = calculateDistanceKm(userCoords.lat, userCoords.lng, b.lat, b.lng);
        return distA - distB;
      });
  }, [stores, onlyOpenFilter, networkQuery, userCoords.lat, userCoords.lng]);

  const selectedStore =
    registeredStores.find((s) => s.id === selectedStoreId) ||
    registeredStores[0] ||
    stores[0] ||
    null;

  const mapCenter = selectedStore
    ? { lat: selectedStore.lat, lng: selectedStore.lng }
    : userCoords;

  const handleBrowserGeolocation = () => {
    if (!('geolocation' in navigator)) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onUpdateUserLocation(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          `GPS Atual (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`
        );
        setLocatingGps(false);
      },
      () => {
        onUpdateUserLocation(
          { lat: -23.5649, lng: -46.652 },
          'Av. Paulista, 1000'
        );
        setLocatingGps(false);
      },
      { timeout: 5000 }
    );
  };

  const handleRunRadarSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSearchNearbyOpenTabacarias(networkQuery);
  };

  return (
    <section aria-labelledby="geomap-heading" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#26272B] pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#F5A623]">
            Geolocalização &amp; Estabelecimentos Cadastrados
          </p>
          <h2 id="geomap-heading" className="text-xl sm:text-2xl font-extrabold text-white">
            Radar de Tabacarias Cadastradas
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="preset-location-select" className="sr-only">
            Selecionar endereço de entrega
          </label>
          <select
            id="preset-location-select"
            value={userAddressLabel}
            onChange={(e) => {
              const found = PRESET_LOCATIONS.find((p) => p.label === e.target.value);
              if (found) {
                onUpdateUserLocation({ lat: found.lat, lng: found.lng }, found.label);
              }
            }}
            className="rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-[#F5A623] min-h-[40px]"
          >
            {PRESET_LOCATIONS.map((loc) => (
              <option key={loc.label} value={loc.label}>
                Entregar em: {loc.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleBrowserGeolocation}
            className="px-3.5 py-2 rounded-xl bg-[#F5A623] text-[#0B0B0D] text-xs font-bold hover:bg-[#F59E0B] transition-colors flex items-center gap-1.5 min-h-[40px] whitespace-nowrap"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{locatingGps ? 'Localizando...' : 'Usar Meu GPS'}</span>
          </button>
        </div>
      </div>

      {/* Search Bar for Platform-Registered Tabacarias */}
      <form
        onSubmit={handleRunRadarSearch}
        className="p-3.5 rounded-2xl bg-[#1A1B1E] border border-[#26272B] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#F5A623] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <label htmlFor="radar-network-search" className="sr-only">
            Buscar entre as tabacarias cadastradas na plataforma
          </label>
          <input
            id="radar-network-search"
            type="text"
            value={networkQuery}
            onChange={(e) => setNetworkQuery(e.target.value)}
            placeholder="Filtrar tabacarias cadastradas por nome, bairro ou especialidade..."
            className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] pl-10 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyOpenFilter((prev) => !prev)}
            className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 ${
              onlyOpenFilter
                ? 'bg-[#0E3A2F] border-[#22C55E]/50 text-[#4ADE80]'
                : 'bg-[#0B0B0D] border-[#26272B] text-[#9CA3AF]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span>Abertas Agora ({registeredStores.length})</span>
          </button>

          <button
            type="submit"
            disabled={isSearchingNetwork}
            className="px-4 py-2.5 rounded-xl bg-[#F5A623] hover:bg-[#F59E0B] text-[#0B0B0D] text-xs font-extrabold flex items-center gap-1.5 shrink-0"
          >
            <Radar className="w-4 h-4" />
            <span>
              {isSearchingNetwork ? 'Atualizando...' : 'Atualizar Radar'}
            </span>
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Registered Store List + Active Delivery Tracker */}
        <div className="lg:col-span-5 space-y-3">
          {activeOrder && (
            <div className="p-4 rounded-2xl bg-[#1A1B1E] border border-[#F5A623]/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#F5A623] flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  Rastreio em Tempo Real · #{activeOrder.orderId}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#0E3A2F] text-[#4ADE80] text-[11px] font-semibold">
                  {activeOrder.status === 'confirmed' && 'Confirmado'}
                  {activeOrder.status === 'preparing' && 'Preparando'}
                  {activeOrder.status === 'delivering' && 'Enviado · Em Rota'}
                  {activeOrder.status === 'delivered' && 'Entregue'}
                </span>
              </div>
              <p className="text-xs font-semibold text-white">
                {activeOrder.storeName} → {activeOrder.deliveryAddress}
              </p>
              <p className="text-xs text-[#9CA3AF]">{activeOrder.itemsSummary}</p>
            </div>
          )}

          {registeredStores.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#1A1B1E] border border-[#26272B] text-center space-y-3">
              <Store className="w-8 h-8 text-[#F5A623] mx-auto" />
              <p className="text-sm font-bold text-white">
                Nenhum estabelecimento cadastrado na plataforma ainda.
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Apenas tabacarias e lugares oficialmente cadastrados no Perfil aparecem no mapa e no catálogo.
              </p>
              <button
                type="button"
                onClick={onGoToProfileRegistration}
                className="px-4 py-2.5 rounded-xl bg-[#F5A623] hover:bg-[#F59E0B] text-[#0B0B0D] text-xs font-extrabold transition-colors"
              >
                Ir ao Perfil para Cadastrar Estabelecimento
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {registeredStores.map((store) => {
                const dist = calculateDistanceKm(
                  userCoords.lat,
                  userCoords.lng,
                  store.lat,
                  store.lng
                );
                const eta = estimateDeliveryMinutes(dist, store.prepMinutes);
                const isSelected = selectedStore?.id === store.id;

                return (
                  <div
                    key={store.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-[#1A1B1E] border-[#F5A623]'
                        : 'bg-[#1A1B1E] border-[#26272B] hover:border-[#3F4147]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white">{store.name}</h3>
                        <p className="text-xs text-[#9CA3AF]">{store.neighborhood}</p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 shrink-0 ${
                          store.isOpen
                            ? 'bg-[#0E3A2F] text-[#4ADE80]'
                            : 'bg-[#3F1D1D] text-[#F87171]'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            store.isOpen ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                          }`}
                        />
                        {store.isOpen ? 'Aberto' : 'Fechado'}
                      </span>
                    </div>

                    <p className="text-xs text-[#D1D5DB] mt-1.5">{store.specialty}</p>

                    <div className="mt-3 pt-2.5 border-t border-[#26272B] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3 text-[#9CA3AF] font-mono-tabular">
                        <span className="text-[#F5A623] font-bold">
                          ★ {store.rating.toFixed(1)}
                        </span>
                        <span>{dist} km</span>
                        <span className="flex items-center gap-1 text-white">
                          <Clock className="w-3.5 h-3.5 text-[#F5A623]" />
                          ~{eta} min
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectStore(store.id);
                            setInfoOpenStoreId(store.id);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#26272B] bg-[#0B0B0D] text-xs font-semibold text-white hover:border-[#F5A623]"
                        >
                          Focar Pino
                        </button>
                        <button
                          type="button"
                          onClick={() => onFilterStoreCatalog(store.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#F5A623] text-[#0B0B0D] text-xs font-bold hover:bg-[#F59E0B]"
                        >
                          Ver Produtos
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Interactive Google Map */}
        <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#26272B] bg-[#1A1B1E] h-[380px] sm:h-[460px] relative">
          {apiKey ? (
            <APIProvider apiKey={apiKey} libraries={['marker']}>
              <GoogleMap
                mapId="DEMO_MAP_ID"
                defaultCenter={mapCenter}
                defaultZoom={14}
                gestureHandling="greedy"
                disableDefaultUI={false}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                className="w-full h-full"
              >
                <AdvancedMarker position={userCoords} title="Seu Endereço de Entrega">
                  <Pin
                    background="#10B981"
                    borderColor="#047857"
                    glyphColor="#FFFFFF"
                  />
                </AdvancedMarker>

                {registeredStores.map((st) => (
                  <AdvancedMarker
                    key={st.id}
                    position={{ lat: st.lat, lng: st.lng }}
                    title={st.name}
                    onClick={() => {
                      onSelectStore(st.id);
                      setInfoOpenStoreId(st.id);
                    }}
                  >
                    <Pin
                      background={st.id === selectedStore?.id ? '#F5A623' : '#EF4444'}
                      borderColor="#0B0B0D"
                      glyphColor="#0B0B0D"
                    />
                  </AdvancedMarker>
                ))}

                {infoOpenStoreId && selectedStore && (
                  <InfoWindow
                    position={{
                      lat: (
                        registeredStores.find((s) => s.id === infoOpenStoreId) ||
                        selectedStore
                      ).lat,
                      lng: (
                        registeredStores.find((s) => s.id === infoOpenStoreId) ||
                        selectedStore
                      ).lng,
                    }}
                    onCloseClick={() => setInfoOpenStoreId(null)}
                  >
                    <div className="p-1 text-stone-900 max-w-[210px] space-y-1">
                      <p className="font-bold text-xs">
                        {
                          (
                            registeredStores.find((s) => s.id === infoOpenStoreId) ||
                            selectedStore
                          ).name
                        }
                      </p>
                      <p className="text-[11px] text-stone-600">
                        {
                          (
                            registeredStores.find((s) => s.id === infoOpenStoreId) ||
                            selectedStore
                          ).address
                        }
                      </p>
                      <p className="text-[11px] font-semibold text-amber-700">
                        Cadastrado na Plataforma · Pague na Entrega
                      </p>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
              <MapPin className="w-8 h-8 text-[#F5A623]" />
              <p className="text-sm font-bold text-white">
                Mapa de Geolocalização Ifumo
              </p>
              <p className="text-xs text-[#9CA3AF] max-w-md">
                {selectedStore
                  ? `${selectedStore.name} · ${selectedStore.address}`
                  : `Entrega expressa para ${userAddressLabel}`}
              </p>
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 sm:right-auto rounded-xl bg-[#0B0B0D]/90 backdrop-blur-md border border-[#26272B] px-3.5 py-2 flex items-center gap-2 text-xs text-white">
            <ShieldCheck className="w-4 h-4 text-[#F5A623] shrink-0" />
            <span>
              Apenas estabelecimentos cadastrados · Pagamento na Entrega (+18)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
