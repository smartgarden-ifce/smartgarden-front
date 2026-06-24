# SmartGarden Front

Frontend inicial do SmartGarden em `Angular 19`, padronizado com `pnpm`.

## O que existe hoje

- dashboard principal com resumo agregado
- navegação lateral responsiva entre as áreas do sistema
- página de monitoramento com gráfico e telemetria paginada
- página de dispositivos com listagem e status; cadastro administrativo pelo Swagger
- página de relatório ambiental por dispositivo e período
- download direto do relatório em PDF
- critérios ambientais documentados no dashboard e no relatório

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
- `GET /api/readings/history?deviceCode=...&hours=24&limit=120`
- `GET /api/reports/environmental?deviceCode=...&startAt=...&endAt=...`

## Relatórios

Acesse `http://localhost:4200/relatorios` ou use o link **Relatórios** na navegação lateral.

A página permite selecionar um sensor e um período de até 31 dias usando os componentes Select e DatePicker do PrimeNG. A tela apresenta indicadores, diagnóstico, exceções e o histórico completo paginado. O botão **Baixar PDF** reúne resumo, diagnóstico, critérios, exceções e todas as leituras do período.

Os limites de temperatura e umidade vêm do backend; o frontend não mantém uma segunda configuração dessas faixas.

## Build

```bash
pnpm build
```
