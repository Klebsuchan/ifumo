# Referência da API REST & Eventos SSE — iFumo Delivery

Todos os endpoints são servidos a partir da mesma origem na porta `3000` sob o prefixo `/api`.

---

## 1. Bootstrap & Sincronização em Tempo Real

### `GET /api/bootstrap`
Retorna o estado atual persistido no servidor (estabelecimentos cadastrados, produtos do cardápio, pedidos, avaliações, mensagens de suporte e estatísticas).

**Resposta `200 OK`:**
```json
{
  "stores": [],
  "products": [],
  "orders": [],
  "reviews": [],
  "supportMessages": [],
  "stats": {
    "totalRevenue": 0,
    "activeOrdersCount": 0,
    "deliveredOrdersCount": 0,
    "avgEtaMinutes": 24,
    "connectedClients": 1
  },
  "serverTime": "2026-11-17T17:30:00.000Z"
}
```

### `GET /api/events`
Abre uma conexão **Server-Sent Events (`text/event-stream`)**.

**Eventos transmitidos:**
- `connected`: Confirmação de conexão no stream.
- `store_created`: Novo estabelecimento cadastrado no Perfil.
- `store_updated`: Status `isOpen` (`Aberto` / `Fechado`) alterado.
- `product_created`: Novo item adicionado ao Cardápio Estilo iFood.
- `product_updated`: Preço, categoria ou estoque (`inStock`) atualizado.
- `product_deleted`: Produto removido do cardápio (`{ "id": "prod_..." }`).
- `order_created`: Novo pedido confirmado pelo cliente.
- `order_updated`: Status do pedido atualizado (`preparing`, `delivering`, `delivered`, `cancelled`).
- `review_created`: Nova avaliação publicada.
- `support_message`: Nova mensagem no chat de suporte 24h.
- `push_notification`: Alerta transmitido para os clientes conectados.

---

## 2. Estabelecimentos (`/api/stores`)

### `POST /api/stores`
Cadastra uma nova tabacaria oficialmente na plataforma.

**Corpo da Requisição (`application/json`):**
```json
{
  "name": "Tabacaria Paulista 24h",
  "neighborhood": "Bela Vista · São Paulo",
  "address": "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
  "lat": -23.5649,
  "lng": -46.6520,
  "specialty": "Marlboro, Camel, Kretek, Harmony, Charutos & Sedas",
  "etaRangeLabel": "20-30 min",
  "deliveryLabel": "Grátis",
  "isOpen": true,
  "ownerId": "uid_do_parceiro"
}
```

### `PATCH /api/stores/:storeId/status`
Alterna ou define explicitamente o status de funcionamento (**Aberto / Fechado**) da tabacaria.

**Corpo da Requisição (`application/json`):**
```json
{
  "isOpen": true
}
```

---

## 3. Cardápio Estilo iFood (`/api/products`)

### `POST /api/products`
Adiciona um novo produto ao cardápio de um estabelecimento cadastrado.

**Corpo da Requisição (`application/json`):**
```json
{
  "storeId": "store_custom_...",
  "storeName": "Tabacaria Paulista 24h",
  "name": "Marlboro Red King Size (Maço 20 un.)",
  "category": "Cigarros",
  "price": 14.50,
  "description": "Maço original lacrado a pronta entrega.",
  "origin": "Original Lacrado",
  "image": "/src/assets/images/cig_marlboro_pack_1794927241031.jpg"
}
```

### `PATCH /api/products/:productId`
Atualiza o preço, nome, categoria, imagem ou disponibilidade (`inStock`: Ativo/Pausado) de um item do cardápio.

**Corpo da Requisição (`application/json`):**
```json
{
  "price": 15.00,
  "inStock": true
}
```

### `DELETE /api/products/:productId`
Remove permanentemente um produto do cardápio da plataforma e notifica todos os clientes via SSE (`product_deleted`).

---

## 4. Gestão de Pedidos (`/api/orders`)

### `POST /api/orders`
Cria um novo pedido com pagamento na entrega (`pix_entrega`, `cartao_entrega` ou `dinheiro_entrega`).

**Corpo da Requisição (`application/json`):**
```json
{
  "customerName": "Lucas Andrade",
  "storeId": "store_custom_...",
  "storeName": "Tabacaria Paulista 24h",
  "itemsSummary": "2x Marlboro Red King Size",
  "totalAmount": 29.00,
  "deliveryFee": 0,
  "paymentMethod": "pix_entrega",
  "deliveryAddress": "Av. Paulista, 1000 - Bela Vista, São Paulo"
}
```

### `PATCH /api/orders/:orderId/status`
Permite ao estabelecimento atualizar o andamento do pedido na aba **3. Pedidos**:
- `"preparing"`: **Em Preparo**
- `"delivering"`: **Passar para Enviado** (motoboy saiu para entrega)
- `"delivered"`: **Passar para Entregue** (entrega concluída)
- `"cancelled"`: **Cancelar**

**Corpo da Requisição (`application/json`):**
```json
{
  "status": "delivering"
}
```

---

## 5. Geolocalização & Busca de Tabacarias (`/api/geocode` e `/api/tabacarias/nearby`)

### `GET /api/geocode?address=<endereco>`
Converte um endereço em texto para coordenadas geográficas reais (`lat`, `lng`, `formattedAddress`) usando Google Geocoding API com fallback automático para OpenStreetMap Nominatim.

### `GET /api/tabacarias/nearby?lat=-23.5649&lng=-46.6520&radiusKm=15&onlyOpen=true`
Filtra exclusivamente os estabelecimentos cadastrados na plataforma dentro do raio especificado em quilômetros, ordenando do mais próximo para o mais distante.
