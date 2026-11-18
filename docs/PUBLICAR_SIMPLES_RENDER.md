# Simples Nacional — serviço conectado e em produção

**Instalação concluída em 18/11/2026.** Não é preciso criar outro serviço para usar a calculadora.

## Arquitetura ativa

- Front-end: [Calculadora RTC](https://rtc-calculadora-theta.vercel.app/), módulo **Simples Nacional**.
- Proxy Vercel: `/api/simples`, com validação de origem, limite de tamanho, regras de rota e encaminhamento ao Java.
- Render (workspace **javaaaa**): [serviço rtc-simples-nacional-java](https://dashboard.render.com/web/srv-dbuti495efls73b91na0), plano **Free**, Docker Java 21.
- Banco: SQLite gerado automaticamente pela etapa de migração do Regime Regular, versão `V0059`, incorporado à imagem Docker.
- Autenticação: `X-RTC-Engine-Key`, **somente entre Vercel e Render**. A chave é armazenada nas variáveis de ambiente protegidas de ambos. Não está no navegador nem no repositório.

A consulta pública `/api/simples?route=versao` e o cálculo de uma operação por item retornaram **HTTP 200**; o motor retornou `CALCULADO`. [Evidência do teste de produção](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/runs/44355319524).

## Para quem usa a calculadora

Não há configuração individual. O módulo se conecta automaticamente. Se o Render gratuito hibernar, a interface mostra que o serviço está iniciando e tenta reconectar em intervalos crescentes, preservando os valores já digitados. A disponibilidade não é 100% garantida pelo plano Free.

## Para manutenção

- Verifique o status do serviço no [Render](https://dashboard.render.com/web/srv-dbuti495efls73b91na0).
- Confira as variáveis `RTC_SIMPLES_ENGINE_URL` e `RTC_SIMPLES_ENGINE_SHARED_KEY` na Vercel. A URL deve terminar em `/api`. Não copie segredos para logs, issues ou chats.
- Quando alterar uma variável do Render ou da Vercel, reimplante a aplicação correspondente se necessário.
- Se o serviço do Render ficar em falha, consulte deploys e logs antes de alterar qualquer fórmula fiscal.
- O Dockerfile do serviço é `infra/Dockerfile.simples.render`; o filtro de autenticação é `infra/simples/EngineKeyFilter.java`.
- O arquivo `render.yaml` é **apenas uma referência para outra instalação**. Não importe esse Blueprint no workspace atual: isso pode duplicar o serviço.

## Limites importantes

A hospedagem gratuita pode suspender instâncias por inatividade e ter inicialização lenta. O código do motor é a versão de referência copiada da Receita Federal, mas a execução e a interface são independentes e não representam homologação fiscal oficial. Resultados devem ser conferidos conforme enquadramento e vigência das regras.
