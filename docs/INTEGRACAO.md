# Integração e homologação da Calculadora RTC

## Código preservado

O código completo foi copiado sem mesclar os pacotes Java dos projetos:

- `motores/regime-regular/`: snapshot de `ReceitaFederal/calculadora-rtc-regime-regular`, incluindo migrações, XSD, testes, documentação e `LICENSE` MIT.
- `motores/simples-nacional/`: snapshot de `ReceitaFederal/calculadora-rtc-simples-nacional`, incluindo código de cálculo, observabilidade, catálogo de atividades, testes e `LICENSE` MIT.
- `web/`: nossa calculadora de impacto anterior, a interface de Regime Regular, uma nova interface de Simples Nacional e os proxies públicos.

Consulte os SHAs de origem em `docs/VERSOES_ORIGINAIS.txt`, que também estão preservados em cada diretório de motor.

## Instalação local (Java 21 + SQLite)

Os dois motores Java são aplicações separadas, em portas distintas. O código sozinho não inclui o banco SQLite já montado.

Em Linux/macOS/WSL, na raiz do projeto:

```bash
bash infra/setup-db.sh
docker compose -f infra/compose.yaml up --build
```

O primeiro comando usa as migrações do motor Regime Regular para gerar `infra/data/calculadora-pro.db`. O Docker Compose monta esse banco como somente leitura nos dois serviços. **Isso precisa ser homologado** contra a versão exata do Simples Nacional, especialmente para os catálogos de atividades, os parâmetros e as vigências; não presumir compatibilidade só porque as tabelas existem.

Após inicialização e validação dos logs:

- Regime Regular: `http://localhost:8080/api/calculadora/dados-abertos/versao`.
- Simples Nacional: `http://localhost:8082/api/versao`.

Confira nos READMEs originais os caminhos do Swagger, os requisitos de execução, os limites das tabelas e a necessidade de atualização.

## Interface web (Vercel)

Importe `calculadoraaa` na Vercel definindo **Root Directory = web**. Os caminhos previstos são:

- `/`: painel unificado com simulador, Regime Regular, Simples, pedágio, NFS-e, bases, consultas e XML.
- `/simulador`: simulador de impacto original preservado.
- `/oficial`: abre o Regime Regular dentro do painel.
- `/simples`: abre o Simples Nacional dentro do painel.
- `/painel`: abre o mesmo ambiente integrado.
- `/api/rtc`: proxy protegido ao motor de Regime Regular.
- `/api/simples`: proxy ao motor próprio de Simples Nacional.
- `/api/iss`: consulta ao snapshot público NFS-e de ISS de 03/09/2026.

Variáveis de ambiente do projeto Vercel (exemplo em `web/.env.example`):

- `RTC_OFFICIAL_ENGINE_URL`: URL HTTPS do serviço Regime Regular **terminando em `/api/calculadora`**.
- `RTC_ENGINE_SHARED_KEY`: chave interna, se o Render do Regime Regular a exigir.
- `RTC_SIMPLES_ENGINE_URL`: URL HTTPS do serviço Simples Nacional **terminando em `/api`**.
- `RTC_SIMPLES_ENGINE_SHARED_KEY`: opcional, apenas se o serviço Simples tiver middleware de autenticação por chave.

**Estado atual da instalação:** o serviço Java do Simples Nacional foi implantado no Render Free (workspace `javaaaa`) e está ligado ao proxy da Vercel por variáveis server-side. O usuário final não insere chave nem configura motor. Para replicar o projeto em outro ambiente, ainda é necessário hospedar Java e configurar as variáveis correspondentes.

Os proxies são públicos e têm controles básicos em memória. Antes de tráfego público relevante, implantar rate limiting distribuído, proteção contra abuso, métricas e custos monitorados.

## O que ainda depende de integração e homologação

O repositório inclui o código completo dos motores oficiais. O painel agora oferece formulários específicos para pedágio, validação de indicadores de NFS-e, cálculo de base NFS-e, bases especiais CBS/IBS e IS, e um catálogo de consultas. **Nem todos os endpoints têm um formulário específico**: compras governamentais detalhadas, tributação regular especial por item, indicadores de crédito, alguns tratamentos avançados NFS-e, a memória integral e todos os formatos XML ainda exigem trabalho. O Simples depende de um serviço Java separado: veja `docs/PUBLICAR_SIMPLES_RENDER.md`.

É necessário testar o motor com bancos corretos, confrontar resultados com os exemplos oficiais, distinguir itens CALCULADO/NAO_CALCULADO/INCONSISTENCIA_ENTRADA/NAO_IMPLEMENTADO e validar as versões e vigências antes de qualquer uso fiscal profissional.

## Como atualizar os códigos oficiais

O workflow `.github/workflows/importar-motores.yml` trouxe ambos os códigos e preservou licenças. Ele não sobreescreve alterações locais por padrão; para atualizar deliberadamente, use o acionamento manual (workflow_dispatch) com `atualizar=true`, revise o diff e execute a homologação novamente.

## Responsabilidade e licença

Copyright © 2026 Receita Federal do Brasil nos dois motores, sob licença MIT. Não apresentar esta instalação independente como ferramenta mantida, aprovada ou operada pela Receita Federal. Resultados simulados não equivalem à apuração ou autorização fiscal.
