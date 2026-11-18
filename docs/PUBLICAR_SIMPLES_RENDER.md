# Publicar o Simples Nacional no Render gratuito

O código Java do Simples Nacional, o SQLite gerado pelas migrações da Receita e uma camada própria de autenticação já estão preparados no `infra/Dockerfile.simples.render`.

A criação automática do serviço pelo assistente não foi autorizada pela ferramenta de implantação. **Não foi criado nenhum serviço adicional nem gerada cobrança.** Por isso, deixamos um Blueprint em `render.yaml` para concluir a operação pelo painel do Render.

## Implantação no workspace `javaaaa`

1. Abra o [painel de Blueprints do Render](https://dashboard.render.com/blueprints).
2. Escolha **New Blueprint** e selecione o repositório público `Gabriel-Luis-Pacheco/calculadoraaa`, branch `main`.
3. Revise o plano: **um único web service gratuito**, nome `rtc-simples-nacional-java`, região Virginia e Dockerfile `infra/Dockerfile.simples.render`. O Regime Regular existente não faz parte deste Blueprint e deve permanecer intacto.
4. Aprove a criação apenas se a tela confirmar **plano Free e custo de US$ 0**, sem serviços pagos.
5. Aguarde o deploy ficar `Live` e copie o endereço `https://rtc-simples-nacional-java.onrender.com` que o Render atribuir (ele pode variar).

A variável `RTC_ENGINE_SHARED_KEY` é gerada automaticamente pelo Render. O Dockerfile ativa `RTC_ENGINE_PROTECTED=true`, recusando chamadas ao Java sem o cabeçalho secreto. Não coloque essa chave no GitHub ou no navegador.

## Conexão da Vercel

No projeto `rtc-calculadora` da Vercel, configure **somente no servidor** (ambientes Preview e Production):

- `RTC_SIMPLES_ENGINE_URL`: o URL real do serviço Render **com `/api` no final**, por exemplo `https://rtc-simples-nacional-java.onrender.com/api`.
- `RTC_SIMPLES_ENGINE_SHARED_KEY`: copie a chave gerada pelo Render e armazene como variável **Sensitive/Encrypted**.

Reimplante a Vercel para receber as variáveis. O proxy `web/api/simples.js` envia essa chave exclusivamente da função serverless para o Java. O usuário não precisa de login nem de chave.

### Como conferir

- No Render, o endpoint `GET /api/versao` **sem chave** deve responder `401`.
- Através da Vercel, `GET /api/simples?route=versao` deve responder `200` com a versão da base.
- Faça um cálculo de teste em **Simples Nacional** no painel integrado e verifique um item com estado `CALCULADO`.
- Teste os demais módulos para verificar que o serviço Regime Regular continua funcionando.

O contêiner protegido já passou em [teste automatizado com Docker, SQLite, GET sem chave e operação fiscal válida](https://github.com/Gabriel-Luis-Pacheco/calculadoraaa/actions/workflows/simples-docker.yml).

**Limites:** um serviço gratuito do Render pode hibernar e demorar a iniciar; o sistema não pode garantir disponibilidade ininterrupta. Este procedimento não homologa todas as regras fiscais.
