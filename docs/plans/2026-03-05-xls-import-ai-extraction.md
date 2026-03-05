# XLS Import with AI Extraction

Feature para importar arquivos XLS, extrair academicos usando IA (Grok), e opcionalmente enriquecer perfis via web discovery.

## Fluxo Geral

1. Usuario clica "Importar XLS" na pagina de busca principal
2. Modal abre com drop zone para upload + seletor de auto-enhancement (Nenhum, 5, 10, Todos)
3. Arquivo enviado para API, convertido em JSON, dividido em chunks
4. Cada chunk enviado ao Grok com prompt que define schema de saida obrigatorio
5. Academicos extraidos inseridos no banco via `academic-upsert` (deduplicacao existente)
6. Se auto-enhancement selecionado, trigga web discovery para os N primeiros academicos
7. Modal mostra progresso em tempo real

## API

### `POST /api/import-xls`

Recebe FormData:
- `file`: arquivo XLS/XLSX
- `enhancementCount`: `0 | 5 | 10 | "all"`

Processamento:
1. Parse XLS com `xlsx` (SheetJS) -> JSON bruto
2. Divide em chunks de ~50 linhas
3. Para cada chunk, chama Grok com prompt + dados
4. Grok retorna array de academicos no schema definido
5. Insere cada academico via `academic-upsert.ts`
6. Se `enhancementCount > 0`, chama `discover-academic` para N academicos

### Schema de saida do Grok

```ts
{
  name: string           // obrigatorio
  institution?: string
  program?: string
  degreeLevel?: "MASTERS" | "PHD" | "POSTDOC"
  graduationYear?: number
  dissertationTitle?: string
  dissertationAbstract?: string
  keywords?: string[]
}
```

Campos que a IA nao conseguir inferir voltam `null`.

## Componentes de UI

### Botao na pagina de busca

"Importar XLS" ao lado da barra de busca. Abre o modal.

### `ImportXlsModal`

- Drop zone / input file (aceita `.xls`, `.xlsx`)
- Mostra nome do arquivo selecionado
- Seletor de enhancement em radio/toggle group:
  - "Sem enhancement" (padrao)
  - "5 academicos"
  - "10 academicos"
  - "Todos"
- Botao "Importar"

### `ImportXlsProgress`

Reutiliza padrao visual do `WebDiscoveryProgress`. Etapas:

1. "Lendo arquivo..."
2. "Extraindo academicos com IA... (chunk 2/5)"
3. "Inserindo no banco... (15/23 academicos)"
4. "Enriquecendo perfis... (3/10)" (se enhancement selecionado)
5. "Concluido! X academicos importados, Y enriquecidos"

Resumo final com contagem e botao para fechar.

## Tratamento de Erros

- **Arquivo invalido:** validacao no frontend (extensao) + backend (parse). Erro amigavel.
- **XLS sem dados uteis:** se Grok nao extrair nenhum academico, mostra "Nenhum academico encontrado"
- **Duplicatas:** `academic-upsert` existente cuida disso
- **Falha do Grok em um chunk:** retry 1x, se falhar pula o chunk. Reporta no resumo.
- **Enhancement falha para um academico:** nao bloqueia os outros. Reporta no resumo.

## Dependencias

- Biblioteca: `xlsx` (SheetJS) - nova dependencia
- Grok API - ja integrada
- `academic-upsert.ts` - existente
- `discover-academic` endpoint - existente
- `WebDiscoveryProgress` - referencia visual

## Arquivos a criar/modificar

### Novos
- `src/app/api/import-xls/route.ts` - API endpoint
- `src/components/import/ImportXlsModal.tsx` - modal de upload
- `src/components/import/ImportXlsProgress.tsx` - modal de progresso
- `src/lib/grok/import-xls-prompt.ts` - prompt para extracao

### Modificados
- `src/app/page.tsx` ou `SearchResultsV2.tsx` - adicionar botao "Importar XLS"
- `package.json` - adicionar dependencia `xlsx`
