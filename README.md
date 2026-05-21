# SmartGarden Front

Frontend inicial do SmartGarden em `Angular 19`, padronizado com `pnpm`.

## O que existe hoje

- dashboard principal com resumo agregado
- cards de dispositivos, leituras e médias
- lista da última leitura por dispositivo
- tabela paginada de leituras recentes
- filtro por dispositivo

## API esperada

O frontend consome o backend em:

`http://localhost:8080/api`

Essa URL está definida em:

`src/app/core/services/smartgarden-api.service.ts`

## Como rodar

Na pasta `smartgarden-front`:

```bash
# se o pnpm nao estiver instalado globalmente
npm install -g pnpm

pnpm install
pnpm start
```

Depois abra:

`http://localhost:4200`

## Backend necessário

Antes de abrir o frontend, deixe o backend rodando em `localhost:8080`.

Endpoints usados:

- `GET /api/dashboard/summary?hours=24`
- `GET /api/devices`
- `GET /api/readings?page=0&size=10`

## Build

```bash
pnpm build
```
