import React, { useState } from 'react';
import {
  MapPin,
  Store,
  Navigation,
  Search,
  CheckCircle2,
  X,
  PlusCircle,
  Clock,
  Truck,
} from 'lucide-react';
import { PartnerStore } from '../data/mockCatalog';

export interface PlaceRegistrationPayload {
  name: string;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  prepMinutes: number;
  etaRangeLabel: string;
  deliveryLabel: string;
  specialty: string;
  isOpen: boolean;
  seedCatalog: boolean;
}

interface PlaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoords: { lat: number; lng: number } | null;
  stores: PartnerStore[];
  onRegisterPlace: (payload: PlaceRegistrationPayload) => Promise<void>;
  onToggleStoreOpen: (storeId: string, nextIsOpen: boolean) => Promise<void>;
  onSelectStoreOnMap: (storeId: string) => void;
}

export function PlaceRegistrationModal({
  isOpen,
  onClose,
  userCoords,
  stores,
  onRegisterPlace,
  onToggleStoreOpen,
  onSelectStoreOnMap,
}: PlaceRegistrationModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [lat, setLat] = useState<string>(userCoords ? String(userCoords.lat) : '');
  const [lng, setLng] = useState<string>(userCoords ? String(userCoords.lng) : '');
  const [specialty, setSpecialty] = useState(
    'Marlboro, Camel, Kretek, Harmony, Sedas RAW & Isqueiros'
  );
  const [etaRangeLabel, setEtaRangeLabel] = useState('20-30 min');
  const [deliveryLabel, setDeliveryLabel] = useState('Grátis');
  const [isPlaceOpen, setIsPlaceOpen] = useState(true);
  const [seedCatalog, setSeedCatalog] = useState(true);

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleGeocodeAddress = async () => {
    const trimmed = address.trim();
    if (trimmed.length < 4) {
      setErrorMsg('Digite o endereço (rua e número) antes de buscar as coordenadas.');
      return;
    }
    setErrorMsg('');
    setIsGeocoding(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.lat && data.lng) {
          setLat(String(Number(data.lat).toFixed(6)));
          setLng(String(Number(data.lng).toFixed(6)));
          if (!neighborhood.trim() && data.label) {
            const parts = String(data.label).split('·');
            if (parts[1]) setNeighborhood(parts[1].trim());
          }
          setSuccessMsg('Coordenadas GPS localizadas pelo endereço!');
        }
      }
    } catch {
      setErrorMsg('Não foi possível geocodificar agora. As coordenadas serão resolvidas ao salvar.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUseCurrentGps = () => {
    setErrorMsg('');
    if (!('geolocation' in navigator)) {
      if (userCoords) {
        setLat(String(userCoords.lat));
        setLng(String(userCoords.lng));
        setSuccessMsg('Coordenadas atuais aplicadas!');
      } else {
        setErrorMsg('GPS indisponível. Digite o endereço e clique em Geocodificar.');
      }
      return;
    }
    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const cLat = Number(pos.coords.latitude.toFixed(6));
        const cLng = Number(pos.coords.longitude.toFixed(6));
        setLat(String(cLat));
        setLng(String(cLng));
        try {
          const res = await fetch(`/api/geocode?lat=${cLat}&lng=${cLng}`);
          if (res.ok) {
            const data = await res.json();
            if (data.label && !address.trim()) {
              setAddress(data.label);
            }
          }
        } catch {
          // Ignore reverse geocode error
        } finally {
          setIsGeocoding(false);
          setSuccessMsg('GPS do seu dispositivo capturado com sucesso!');
        }
      },
      () => {
        if (userCoords) {
          setLat(String(userCoords.lat));
          setLng(String(userCoords.lng));
          setSuccessMsg('Coordenadas do mapa aplicadas!');
        } else {
          setErrorMsg('Não foi possível acessar o GPS. Use Geocodificar após digitar o endereço.');
        }
        setIsGeocoding(false);
      },
      { timeout: 5000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanAddress = address.trim();

    if (cleanName.length < 2) {
      setErrorMsg('Informe o nome do lugar ou tabacaria (mínimo 2 caracteres).');
      return;
    }
    if (cleanAddress.length < 5) {
      setErrorMsg('Informe o endereço completo do estabelecimento.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      await onRegisterPlace({
        name: cleanName,
        neighborhood: neighborhood.trim() || 'Centro',
        address: cleanAddress,
        lat: Number(lat) || userCoords?.lat || 0,
        lng: Number(lng) || userCoords?.lng || 0,
        prepMinutes: 8,
        etaRangeLabel: etaRangeLabel.trim() || '20-30 min',
        deliveryLabel: deliveryLabel.trim() || 'Grátis',
        specialty:
          specialty.trim() ||
          'Marlboro, Camel, Kretek, Harmony, Sedas & Isqueiros',
        isOpen: isPlaceOpen,
        seedCatalog,
      });

      setName('');
      setAddress('');
      setNeighborhood('');
      setSuccessMsg(`Lugar "${cleanName}" cadastrado e publicado no mapa e catálogo!`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao cadastrar o estabelecimento.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-place-title"
    >
      <div className="w-full max-w-lg bg-[#141518] border border-[#26272B] rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto p-5 text-white shadow-2xl space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#26272B] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/40 flex items-center justify-center text-[#F5A623]">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#F5A623]">
                Rede Real &amp; Geolocalização GPS
              </p>
              <h2 id="register-place-title" className="text-base sm:text-lg font-extrabold text-white">
                Cadastro de Lugares &amp; Tabacarias
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar cadastro de lugares"
            className="p-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-[#1A1B1E]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Place Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="place-name-input"
                className="block text-xs font-semibold text-[#9CA3AF]"
              >
                Nome do Lugar / Tabacaria *
              </label>
              <input
                id="place-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Tabacaria Bela Vista 24h"
                className="w-full rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="place-neighborhood-input"
                className="block text-xs font-semibold text-[#9CA3AF]"
              >
                Bairro / Região
              </label>
              <input
                id="place-neighborhood-input"
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex: Centro · Sua Cidade"
                className="w-full rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="place-address-input"
              className="block text-xs font-semibold text-[#9CA3AF]"
            >
              Endereço Completo (Rua, Número, Cidade) *
            </label>
            <div className="flex gap-2">
              <input
                id="place-address-input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Rua Exemplo, 250 - Centro, Sua Cidade - UF"
                className="flex-1 rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
              />
              <button
                type="button"
                onClick={handleGeocodeAddress}
                disabled={isGeocoding}
                className="px-3 py-2 rounded-xl bg-[#24252A] hover:bg-[#2E3036] border border-[#F5A623]/40 text-xs font-bold text-[#F5A623] flex items-center gap-1.5 shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isGeocoding ? '...' : 'Geocodificar'}</span>
              </button>
            </div>
          </div>

          {/* Coordinates + GPS Capture */}
          <div className="p-3 rounded-2xl bg-[#1A1B1E] border border-[#26272B] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#D1D5DB] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>Coordenadas GPS no Mapa</span>
              </span>
              <button
                type="button"
                onClick={handleUseCurrentGps}
                disabled={isGeocoding}
                className="text-[11px] font-extrabold text-[#F5A623] hover:underline flex items-center gap-1"
              >
                <Navigation className="w-3 h-3" />
                <span>Usar Meu GPS Atual</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="place-lat-input"
                  className="block text-[10px] font-semibold text-[#9CA3AF] mb-1"
                >
                  Latitude
                </label>
                <input
                  id="place-lat-input"
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
              <div>
                <label
                  htmlFor="place-lng-input"
                  className="block text-[10px] font-semibold text-[#9CA3AF] mb-1"
                >
                  Longitude
                </label>
                <input
                  id="place-lng-input"
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full rounded-xl bg-[#0B0B0D] border border-[#26272B] px-3 py-2 text-xs font-mono-tabular text-white focus:outline-none focus:border-[#F5A623]"
                />
              </div>
            </div>
          </div>

          {/* Specialty, Delivery Time & Fee */}
          <div className="space-y-1">
            <label
              htmlFor="place-specialty-input"
              className="block text-xs font-semibold text-[#9CA3AF]"
            >
              Especialidade &amp; Marcas Disponíveis
            </label>
            <input
              id="place-specialty-input"
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ex: Marlboro, Camel, Kretek, Harmony, Charutos & Sedas"
              className="w-full rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A623]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label
                htmlFor="place-eta-input"
                className="block text-[11px] font-semibold text-[#9CA3AF] mb-1"
              >
                <Clock className="w-3 h-3 inline mr-1 text-[#F5A623]" />
                Tempo Entrega
              </label>
              <input
                id="place-eta-input"
                type="text"
                value={etaRangeLabel}
                onChange={(e) => setEtaRangeLabel(e.target.value)}
                placeholder="20-30 min"
                className="w-full rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
              />
            </div>

            <div>
              <label
                htmlFor="place-fee-input"
                className="block text-[11px] font-semibold text-[#9CA3AF] mb-1"
              >
                <Truck className="w-3 h-3 inline mr-1 text-[#F5A623]" />
                Taxa Entrega
              </label>
              <input
                id="place-fee-input"
                type="text"
                value={deliveryLabel}
                onChange={(e) => setDeliveryLabel(e.target.value)}
                placeholder="Grátis"
                className="w-full rounded-xl bg-[#1A1B1E] border border-[#26272B] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5A623]"
              />
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-[#9CA3AF] mb-1">
                Status Agora
              </span>
              <button
                type="button"
                onClick={() => setIsPlaceOpen((prev) => !prev)}
                className={`w-full py-2 px-3 rounded-xl border text-xs font-extrabold transition-colors ${
                  isPlaceOpen
                    ? 'bg-[#0E3A2F] border-[#22C55E] text-[#4ADE80]'
                    : 'bg-[#3F1D1D] border-[#EF4444] text-[#F87171]'
                }`}
              >
                {isPlaceOpen ? '● Aberto' : '○ Fechado'}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1A1B1E] border border-[#26272B] cursor-pointer text-xs text-[#D1D5DB]">
            <input
              type="checkbox"
              checked={seedCatalog}
              onChange={(e) => setSeedCatalog(e.target.checked)}
              className="rounded accent-[#F5A623] w-4 h-4"
            />
            <span>
              Disponibilizar catálogo de cigarros reais (<strong>Marlboro, Camel, Kretek e Harmony</strong>) para pedidos imediatos neste lugar
            </span>
          </label>

          {errorMsg && (
            <p className="text-xs font-semibold text-[#EF4444]">{errorMsg}</p>
          )}
          {successMsg && (
            <p className="text-xs font-semibold text-[#4ADE80] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-2xl bg-[#F5A623] hover:bg-[#F59E0B] text-[#0B0B0D] text-xs sm:text-sm font-extrabold transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Salvando Lugar no Banco & Mapa...'
                : 'Cadastrar Lugar Agora'}
            </span>
          </button>
        </form>

        {/* Registered Places Directory */}
        <div className="border-t border-[#26272B] pt-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#9CA3AF]">
              Lugares Cadastrados na Plataforma ({stores.length})
            </h3>
            <span className="text-[11px] text-[#4ADE80] font-semibold">
              {stores.filter((s) => s.isOpen).length} abertos agora
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {stores.map((st) => (
              <div
                key={st.id}
                className="p-2.5 rounded-xl bg-[#1A1B1E] border border-[#26272B] flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white truncate">{st.name}</p>
                  <p className="text-[11px] text-[#9CA3AF] truncate">
                    {st.address} · {st.neighborhood}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleStoreOpen(st.id, !st.isOpen)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                      st.isOpen
                        ? 'bg-[#0E3A2F] text-[#4ADE80]'
                        : 'bg-[#3F1D1D] text-[#F87171]'
                    }`}
                  >
                    {st.isOpen ? 'Aberto' : 'Fechado'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStoreOnMap(st.id);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0B0B0D] border border-[#26272B] text-[#F5A623] text-[11px] font-bold"
                  >
                    Mapa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
