import { OrderStatus } from '../utils/commerceLogic';

export interface PartnerStore {
  id: string;
  ownerId?: string;
  name: string;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  reviewCountFormatted: string;
  prepMinutes: number;
  etaRangeLabel: string;
  deliveryLabel: string;
  specialty: string;
  isOpen: boolean;
  spriteViewBox: string;
}

export interface ProductItem {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  category:
    | 'Cigarros'
    | 'Tabaco'
    | 'Charutos'
    | 'Seda'
    | 'Isqueiros'
    | 'Vape';
  tagLabel: string;
  description: string;
  origin: string;
  intensity: string;
  rating: number;
  reviewsCountLabel: string;
  price: number;
  image: string;
  spriteViewBox?: string;
  inStock: boolean;
}

export type DeliveryPaymentMethod =
  | 'pix_entrega'
  | 'dinheiro_entrega'
  | 'cartao_credito_entrega'
  | 'cartao_debito_entrega'
  | 'stripe_card'
  | 'pix'
  | 'apple_pay';

export interface OrderRecord {
  orderId: string;
  userId: string;
  customerName: string;
  storeId: string;
  storeName: string;
  itemsSummary: string;
  totalAmount: number;
  deliveryFee: number;
  paymentMethod: DeliveryPaymentMethod;
  stripeTxId: string;
  deliveryAddress: string;
  status: OrderStatus;
  loyaltyEarned: number;
  createdAt: string;
}

export interface StoreReview {
  reviewId: string;
  userId: string;
  authorName: string;
  storeId: string;
  storeName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface SupportChatMessage {
  messageId: string;
  userId: string;
  senderName: string;
  senderRole: 'customer' | 'support';
  text: string;
  createdAt: string;
}

export interface LoyaltyReward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  discountBrl: number;
  code: string;
  stockBadge: string;
}

// Nenhum estabelecimento ou produto fictício pré-cadastrado.
// Apenas estabelecimentos e produtos cadastrados dentro da plataforma aparecem.
export const PARTNER_STORES: PartnerStore[] = [];
export const INITIAL_PRODUCTS: ProductItem[] = [];
export const INITIAL_ORDERS: OrderRecord[] = [];
export const INITIAL_REVIEWS: StoreReview[] = [];
export const INITIAL_SUPPORT_MESSAGES: SupportChatMessage[] = [];

export const PRODUCT_PHOTO_GALLERY: Array<{
  id: string;
  label: string;
  category: ProductItem['category'];
  image: string;
  suggestedName: string;
  suggestedPrice: string;
  suggestedOrigin: string;
}> = [
  {
    id: 'photo_marlboro',
    label: 'Marlboro Red (Maço)',
    category: 'Cigarros',
    image: '/src/assets/images/cig_marlboro_pack_1794927241031.jpg',
    suggestedName: 'Marlboro Red King Size Filtro Clássico (Maço 20 un.)',
    suggestedPrice: '14.50',
    suggestedOrigin: 'Original Lacrado · 20 un.',
  },
  {
    id: 'photo_camel',
    label: 'Camel Yellow Filters',
    category: 'Cigarros',
    image: '/src/assets/images/cig_camel_pack_1794927240185.jpg',
    suggestedName: 'Camel Yellow Filters Turkish Blend (Maço 20 un.)',
    suggestedPrice: '13.90',
    suggestedOrigin: 'Turkish Blend · 20 un.',
  },
  {
    id: 'photo_kretek',
    label: 'Kretek Cravo Gold',
    category: 'Cigarros',
    image: '/src/assets/images/cig_kretek_pack_1794927242926.jpg',
    suggestedName: 'Kretek Indonésio Cravo Premium Gold (Maço 20 un.)',
    suggestedPrice: '24.90',
    suggestedOrigin: 'Indonésia · Cravo Natural',
  },
  {
    id: 'photo_harmony',
    label: 'Harmony Smooth Blend',
    category: 'Cigarros',
    image: '/src/assets/images/cig_harmony_pack_1794927243991.jpg',
    suggestedName: 'Harmony Smooth Blend Prata & Ouro (Maço 20 un.)',
    suggestedPrice: '13.50',
    suggestedOrigin: 'Smooth Blend · 20 un.',
  },
  {
    id: 'photo_charutos',
    label: 'Charutos Habanos',
    category: 'Charutos',
    image: '/src/assets/images/product_cigars_habanos_1794919023985.jpg',
    suggestedName: 'Dupla de Charutos Habanos Robusto Reserva',
    suggestedPrice: '119.90',
    suggestedOrigin: 'Folha Inteira · Boveda 69%',
  },
  {
    id: 'photo_seda_kit',
    label: 'Seda RAW / Tabaco / Isqueiro',
    category: 'Seda',
    image: '/src/assets/images/product_rolling_kit_1794919025601.jpg',
    suggestedName: 'Kit Seda RAW Classic King Size + OCB + Piteiras',
    suggestedPrice: '22.90',
    suggestedOrigin: 'Goma Natural · King Size',
  },
  {
    id: 'photo_vape',
    label: 'Pod Vape / Narguilé',
    category: 'Vape',
    image: '/src/assets/images/product_hookah_narguile_1794919025135.jpg',
    suggestedName: 'Pod System Vape Obsidian 6000 Puffs Ice Mint',
    suggestedPrice: '89.90',
    suggestedOrigin: 'Recarregável USB-C',
  },
];

export const LOYALTY_REWARDS: LoyaltyReward[] = [
  {
    id: 'rew_free_shipping_30',
    title: 'Voucher R$ 30 OFF — Estabelecimentos Parceiros',
    description: 'Desconto imediato em maços de cigarros, sedas e isqueiros cadastrados.',
    pointsCost: 250,
    discountBrl: 30,
    code: 'IFUMO30',
    stockBadge: 'Disponível',
  },
  {
    id: 'rew_cigar_cutter_65',
    title: 'Combo Degustação R$ 65 OFF',
    description: 'Válido para tabacos importados, charutos e pods selecionados.',
    pointsCost: 500,
    discountBrl: 65,
    code: 'RESERVA65',
    stockBadge: 'Disponível',
  },
  {
    id: 'rew_humidor_vip_120',
    title: 'Crédito VIP R$ 120 OFF',
    description: 'Desconto especial para clientes Ouro e Black em qualquer loja cadastrada.',
    pointsCost: 900,
    discountBrl: 120,
    code: 'BLACKVIP120',
    stockBadge: 'Disponível',
  },
];
