# Guia de Desenvolvimento

## Configuração do Ambiente de Desenvolvimento

### 1. Configurar Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

Para desenvolvimento local, certifique-se de que o `.env.local` está configurado para:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_KEY=chave-secreta-da-api
```

### 2. Iniciar o Backend

No diretório `../dashboard`, inicie o backend:

```bash
cd ../dashboard
npm run dev
# ou
yarn dev
```

O backend estará rodando em `http://localhost:3001`

### 3. Iniciar o Frontend

```bash
npm run dev
# ou
yarn dev
```

O frontend estará rodando em `http://localhost:3000`

## Branches

- **main**: Branch de produção — publicada pela Vercel em `https://dashboard.stormeducation.com.br` a cada push
- **development**: Branch de desenvolvimento (aponta para `http://localhost:3001`)

## Funcionalidades Implementadas

### 🔐 Autenticação

#### Login (/)
- Login com email e senha
- Detecção automática de primeiro acesso
- Redirecionamento para `/first-access` quando necessário
- Link "Esqueci minha senha"

#### Primeiro Acesso (/first-access)
- Troca obrigatória de senha temporária
- Validação robusta de senha:
  - Mínimo 8 caracteres
  - Pelo menos uma letra maiúscula
  - Pelo menos uma letra minúscula
  - Pelo menos um número
- Redirecionamento automático para login após sucesso

#### Esqueci Minha Senha (/forgot-password)
- Solicitação de reset de senha por email
- **Modo desenvolvimento**: Mostra token e link diretamente na página
- Em produção: Token enviado por email

#### Reset de Senha (/reset-password)
- Reset de senha usando token recebido
- Mesma validação robusta de senha
- Token válido por 1 hora
- Redirecionamento automático para login após sucesso

### 🏨 Landing do piloto de inglês — Goiás (`/piloto-ingles-goias`)

Página pública para cadastrar hotéis de Goiás interessados no piloto de capacitação em
inglês para o trade de turismo e hospitalidade (parceria Sebrae + ABIH, powered by Storm).
Não exige login; o middleware não interfere.

| Rota | Tela |
|---|---|
| `/piloto-ingles-goias` | Landing + formulário de cadastro |
| `/piloto-ingles-goias/confirme-seu-email` | Aviso após o envio: falta confirmar o e-mail |
| `/piloto-ingles-goias/confirmar#token=…` | Destino do link do e-mail; confirma e redireciona |
| `/piloto-ingles-goias/obrigado` | Cadastro recebido |
| `/piloto-ingles-goias/politica-de-privacidade` | Política de Privacidade do cadastro (LGPD) |

**Fluxo:** o formulário chama `POST /api/piloto-goias/cadastros`; o backend guarda o envio
como pendente e manda um e-mail com o link. O cadastro só é gravado quando a pessoa abre o
link (`POST /api/piloto-goias/cadastros/confirmar`, uso único, 48h). Contrato completo da API
em `dashboard_back/docs/API_REFERENCE.md`, seção "Piloto Goiás".

**Onde mexer** (`src/app/piloto-ingles-goias/`):

- `_lib/config.ts` — rotas, logos dos parceiros e URL da Política
- `_lib/cadastro-service.ts` — chamadas à API e modo de pré-visualização
- `_lib/validacao.ts` — regras e mensagens dos campos
- `_components/formulario-cadastro.tsx` — formulário (máscaras, busca de CEP, erros, Turnstile)
- `politica-de-privacidade/page.tsx` — texto da Política; alterou o tratamento de dados no
  backend, atualize aqui (e a `POLICY_VERSION` em `pilotoGoias.service.ts` do backend)
- Compartilhados: `src/lib/br-validators.ts` (CNPJ numérico/alfanumérico, celular, e-mail),
  `src/lib/cep.ts` (ViaCEP), `src/lib/masks.ts` (máscaras de CNPJ e CEP)

**Identidade visual:** cores e tipografia do site da ABIH (`#323266`, `#5757FF`, Montserrat),
definidas em `globals.css` no escopo `.piloto-goias` — a página é sempre clara, mesmo com o
painel em modo escuro. Logos oficiais em `public/piloto-ingles-goias/` (Sebrae: SVG do portal
sebrae.com.br; ABIH: PNG do site abih.com.br, só com as margens recortadas).

**Pré-visualização sem backend:** fora de produção, `?simular=sucesso` ou `?simular=erro`
na URL percorre as telas sem chamar a API (uma faixa amarela avisa que nada foi enviado).
Em produção o parâmetro é ignorado.

**Variáveis:** usa `NEXT_PUBLIC_API_URL`. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` é opcional, mas
precisa ser definida se o backend tiver `TURNSTILE_SECRET_KEY` — senão todo envio é recusado.

**Pendências conhecidas:** revisão jurídica da Política (papéis de controlador da Storm,
Sebrae e ABIH; prazo de retenção após o piloto); não há tela no painel para consultar os
cadastros (estão na tabela `dash_pilot_hotel_registrations`).

## Testando as Funcionalidades

### 1. Testar Login Normal
1. Acesse `http://localhost:3000`
2. Digite email e senha de um usuário existente
3. Deve aparecer confete e redirecionar para `/dashboard`

### 2. Testar Primeiro Acesso
1. Crie um usuário com `isFirstAccess: true` no backend
2. Tente fazer login
3. Será redirecionado automaticamente para `/first-access`
4. Troque a senha e será redirecionado para login

### 3. Testar Esqueci Minha Senha
1. Acesse `http://localhost:3000`
2. Clique em "Esqueci minha senha"
3. Digite um email válido
4. **Em modo dev**: Token aparecerá na tela com link direto
5. Clique no link ou copie o token
6. Defina nova senha
7. Será redirecionado para login

### 4. Testar Reset de Senha com Token
1. Acesse diretamente: `http://localhost:3000/reset-password?token=SEU_TOKEN`
2. Digite nova senha
3. Confirme a senha
4. Será redirecionado para login

## Endpoints Utilizados

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/first-access/change-password` - Troca de senha no primeiro acesso
- `POST /auth/forgot-password` - Solicitar reset de senha
- `POST /auth/reset-password` - Resetar senha com token

## Validações de Senha

Todas as páginas de troca/reset de senha validam:
- ✅ Mínimo 8 caracteres
- ✅ Pelo menos uma letra maiúscula (A-Z)
- ✅ Pelo menos uma letra minúscula (a-z)
- ✅ Pelo menos um número (0-9)
- ✅ Senha e confirmação devem ser iguais

## Estrutura de Arquivos

```
src/
├── app/
│   ├── page.tsx                    # Página de login principal
│   ├── first-access/
│   │   └── page.tsx                # Primeiro acesso
│   ├── forgot-password/
│   │   └── page.tsx                # Esqueci minha senha
│   └── reset-password/
│       └── page.tsx                # Reset de senha com token
├── lib/
│   └── api.ts                      # Configuração Axios
└── components/
    └── ui/                         # Componentes UI (shadcn/ui)
```

## Modo Desenvolvimento

### Token de Reset Visível

Em desenvolvimento (`NODE_ENV=development` no backend), a página `/forgot-password` mostra:
- 🔧 Banner amarelo "Modo Desenvolvimento"
- Token de reset copiável
- Link direto para a página de reset

Isso facilita os testes sem precisar acessar email.

### Console Logs

O interceptor da API loga todos os erros no console:
```
[API ERROR] POST /auth/login 401 {error: "Invalid credentials"}
```

## Troubleshooting

### Backend não está respondendo
- Verifique se o backend está rodando em `http://localhost:3001`
- Verifique as variáveis de ambiente no `.env.local`
- Verifique a chave da API (`x-api-key`)

### CORS Error
- Certifique-se de que o backend aceita requisições de `http://localhost:3000`
- Verifique se `withCredentials: true` está configurado no axios

### Token Inválido/Expirado
- Tokens de reset expiram em 1 hora
- Solicite um novo token em `/forgot-password`

### Senha não atende requisitos
- Leia as mensagens de erro de validação
- Certifique-se de incluir: maiúscula, minúscula, número
- Mínimo 8 caracteres

## Próximos Passos

- [ ] Implementar Google OAuth
- [ ] Adicionar testes automatizados
- [ ] Implementar refresh token
- [ ] Adicionar rate limiting no frontend
- [ ] Melhorar feedback de loading
- [ ] Adicionar animações de transição

## Suporte

Para dúvidas ou problemas, consulte:
- [API_REFERENCE_FOR_AI.md](./API_REFERENCE_FOR_AI.md) - Documentação completa da API
- Backend: `../dashboard`
