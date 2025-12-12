# API Reference - Dashboard Backend
## Documentação Completa para Desenvolvimento de Frontend com IA

**Base URL:** `https://storm-dashboard-backend-38765971e3ea.herokuapp.com`
**Base URL (Dev):** `http://localhost:3001`
**Versão:** 1.0.0
**Protocolo:** HTTPS/HTTP REST API
**Formato:** JSON

---

## 📋 Índice

1. [Autenticação e Autorização](#autenticação-e-autorização)
2. [Sistema de Roles e Permissões](#sistema-de-roles-e-permissões)
3. [Gestão de Usuários](#gestão-de-usuários)
4. [Gestão de Cupons](#gestão-de-cupons)
5. [Compartilhamento de Cupons (Partners)](#compartilhamento-de-cupons-partners)
6. [Gestão de Senha](#gestão-de-senha)
7. [Modelos de Dados](#modelos-de-dados)
8. [Códigos de Erro](#códigos-de-erro)
9. [Fluxos Completos](#fluxos-completos)

---

## 🔐 Autenticação e Autorização

### Headers Necessários

```typescript
// Para endpoints autenticados
{
  "Authorization": "Bearer {jwt_token}",
  "Content-Type": "application/json"
}

// Para health check
{
  "X-API-Key": "chave-secreta-da-api"
}
```

### Sistema de Roles

| Role | Descrição | Permissões |
|------|-----------|------------|
| `super_admin` | Super administrador | Acesso total ao sistema |
| `admin` | Administrador | Gestão de usuários e cupons |
| `contract_manager` | Gestor de contrato | Gestão do próprio contrato |
| `partner` | Parceiro | Acesso a cupons compartilhados |
| `user` | Usuário comum | Acesso básico |

---

## 🔑 Autenticação

### 1. Login

Autentica um usuário e retorna token JWT. Verifica primeiro acesso.

**Endpoint:** `POST /auth/login`
**Autenticação:** Não
**Rate Limit:** 5 requisições/minuto

**Request Body:**
```typescript
interface LoginRequest {
  email: string;           // Email do usuário
  password: string;        // Senha (hash bcrypt será validado)
}
```

**Success Response (200):**
```typescript
interface LoginSuccessResponse {
  message: string;                    // "Login realizado com sucesso"
  token: string;                      // JWT token válido por 1 hora
  user: {
    id: string;                       // UUID do usuário
    name: string;                     // Nome completo
    email: string;                    // Email
    roleId: string;                   // super_admin | admin | contract_manager | partner | user
    contractId?: string | null;       // ID do contrato (opcional)
    isFirstAccess: boolean;           // false após primeiro login
    lastLoginAt: string;              // ISO 8601 timestamp
  };
}
```

**First Access Response (403):**
```typescript
interface FirstAccessResponse {
  error: "First access required";
  message: "Você precisa alterar sua senha no primeiro acesso";
  isFirstAccess: true;
  email: string;                      // Email para usar no próximo passo
}
```

**Error Response (401):**
```typescript
interface LoginErrorResponse {
  error: "Invalid credentials";
  message: "Email ou senha incorretos";
}
```

**Exemplos de Uso:**

```typescript
// Exemplo 1: Login bem-sucedido
const response = await fetch('https://api.example.com/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@exemplo.com',
    password: 'senha123'
  })
});

const data = await response.json();
// Armazenar token para próximas requisições
localStorage.setItem('authToken', data.token);
localStorage.setItem('user', JSON.stringify(data.user));

// Exemplo 2: Primeiro acesso (redirecionar para troca de senha)
if (response.status === 403) {
  const data = await response.json();
  if (data.isFirstAccess) {
    // Redirecionar para página de troca de senha obrigatória
    router.push('/first-access-change-password', { email: data.email });
  }
}
```

---

### 2. Verificar Primeiro Acesso

Verifica se é o primeiro acesso do usuário (antes de fazer login).

**Endpoint:** `POST /auth/check-first-access`
**Autenticação:** Não
**Público:** Sim

**Request Body:**
```typescript
interface CheckFirstAccessRequest {
  email: string;           // Email do usuário
}
```

**Response (200):**
```typescript
interface CheckFirstAccessResponse {
  email: string;           // Email verificado
  isFirstAccess: boolean;  // true se ainda não trocou senha
  requiresPasswordChange: boolean;  // Mesmo que isFirstAccess
}
```

**Exemplo de Uso:**

```typescript
// Na tela de login, verificar antes de mostrar formulário
const checkFirstAccess = async (email: string) => {
  const response = await fetch('/auth/check-first-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  const data = await response.json();

  if (data.isFirstAccess) {
    // Mostrar aviso: "Primeiro acesso detectado. Após login, você precisará trocar sua senha."
    showWarning('Primeiro acesso detectado');
  }

  return data;
};
```

---

### 3. Health Check

Verifica se a API está online.

**Endpoint:** `GET /api/health`
**Autenticação:** API Key no header

**Headers:**
```typescript
{
  "X-API-Key": "chave-secreta-da-api"
}
```

**Response (200):**
```typescript
interface HealthCheckResponse {
  status: "ok";
  timestamp: string;  // ISO 8601
  uptime: number;     // Segundos desde início
}
```

---

## 👥 Gestão de Usuários

### 1. Listar Todos os Usuários

**Endpoint:** `GET /users`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin

**Query Parameters:**
```typescript
interface ListUsersQuery {
  page?: number;        // Página (padrão: 1)
  limit?: number;       // Itens por página (padrão: 50)
  roleId?: string;      // Filtrar por role
  contractId?: string;  // Filtrar por contrato
  search?: string;      // Buscar por nome ou email
}
```

**Response (200):**
```typescript
interface ListUsersResponse {
  users: Array<{
    id: string;                    // UUID
    name: string;                  // Nome completo
    email: string;                 // Email
    roleId: string;                // Role do usuário
    contractId?: string | null;    // ID do contrato
    isFirstAccess: boolean;        // Se ainda não fez primeiro login
    lastLoginAt?: string | null;   // Último login (ISO 8601)
    passwordChangedAt?: string | null;  // Última troca de senha
    createdAt: string;             // Data de criação
    updatedAt: string;             // Última atualização
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}
```

**Exemplo de Uso:**

```typescript
// Listar usuários com filtros
const fetchUsers = async (filters: {
  page?: number;
  roleId?: string;
  search?: string;
}) => {
  const params = new URLSearchParams();
  if (filters.page) params.append('page', filters.page.toString());
  if (filters.roleId) params.append('roleId', filters.roleId);
  if (filters.search) params.append('search', filters.search);

  const response = await fetch(`/users?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
    }
  });

  return await response.json();
};

// Uso no componente
const users = await fetchUsers({ page: 1, roleId: 'partner' });
```

---

### 2. Buscar Usuário por ID

**Endpoint:** `GET /users/:id`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin, próprio usuário

**Response (200):**
```typescript
interface GetUserResponse {
  id: string;
  name: string;
  email: string;
  roleId: string;
  contractId?: string | null;
  isFirstAccess: boolean;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  role?: {                    // Informação expandida do role
    id: string;
    name: string;
    description: string;
  };
  contract?: {               // Informação expandida do contrato
    id: string;
    name: string;
    active: boolean;
  };
}
```

**Error (404):**
```typescript
interface UserNotFoundError {
  error: "User not found";
  message: "Usuário não encontrado";
}
```

---

### 3. Criar Novo Usuário

**Endpoint:** `POST /users`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin

**Request Body:**
```typescript
interface CreateUserRequest {
  name: string;              // Nome completo (obrigatório)
  email: string;             // Email único (obrigatório)
  password: string;          // Senha inicial (obrigatório, mín 6 caracteres)
  roleId: string;            // super_admin | admin | contract_manager | partner | user
  contractId?: string;       // ID do contrato (opcional, mas obrigatório para contract_manager)
}
```

**Response (201):**
```typescript
interface CreateUserResponse {
  message: "Usuário criado com sucesso";
  user: {
    id: string;              // UUID gerado
    name: string;
    email: string;
    roleId: string;
    contractId?: string | null;
    isFirstAccess: true;     // Sempre true para novo usuário
    createdAt: string;
  };
}
```

**Validation Errors (400):**
```typescript
interface ValidationError {
  error: "Validation error";
  details: Array<{
    field: string;           // Campo com erro
    message: string;         // Mensagem de erro
  }>;
}

// Exemplos de erros de validação:
{
  error: "Validation error",
  details: [
    { field: "email", message: "Email já cadastrado" },
    { field: "password", message: "Senha deve ter no mínimo 6 caracteres" },
    { field: "roleId", message: "Role inválido" }
  ]
}
```

**Exemplo de Uso:**

```typescript
// Formulário de criação de usuário
const createUser = async (formData: {
  name: string;
  email: string;
  password: string;
  roleId: string;
  contractId?: string;
}) => {
  try {
    const response = await fetch('/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const error = await response.json();
      // Mostrar erros de validação no formulário
      error.details?.forEach(err => {
        showFieldError(err.field, err.message);
      });
      return;
    }

    const data = await response.json();

    // Mostrar sucesso
    showSuccess(`Usuário ${data.user.name} criado com sucesso!`);

    // Opcional: Enviar email com senha temporária
    await sendWelcomeEmail(data.user.email, formData.password);

    return data.user;
  } catch (error) {
    showError('Erro ao criar usuário');
  }
};
```

---

### 4. Atualizar Usuário

**Endpoint:** `PUT /users/:id`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin, próprio usuário (campos limitados)

**Request Body (campos opcionais):**
```typescript
interface UpdateUserRequest {
  name?: string;             // Atualizar nome
  email?: string;            // Atualizar email (deve ser único)
  roleId?: string;           // Atualizar role (apenas admin)
  contractId?: string;       // Atualizar contrato (apenas admin)
}
```

**Response (200):**
```typescript
interface UpdateUserResponse {
  message: "Usuário atualizado com sucesso";
  user: {
    id: string;
    name: string;
    email: string;
    roleId: string;
    contractId?: string | null;
    updatedAt: string;       // Timestamp atualizado
  };
}
```

**Exemplo de Uso:**

```typescript
// Atualizar perfil do próprio usuário
const updateProfile = async (userId: string, updates: {
  name?: string;
  email?: string;
}) => {
  const response = await fetch(`/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  return await response.json();
};
```

---

### 5. Deletar Usuário

**Endpoint:** `DELETE /users/:id`
**Autenticação:** Bearer Token
**Permissões:** super_admin apenas

**Response (200):**
```typescript
interface DeleteUserResponse {
  message: "Usuário deletado com sucesso";
  deletedUserId: string;
}
```

**Error (403):**
```typescript
interface DeleteUserError {
  error: "Cannot delete yourself";
  message: "Você não pode deletar sua própria conta";
}
```

**Exemplo de Uso:**

```typescript
// Confirmação antes de deletar
const deleteUser = async (userId: string) => {
  const confirmed = await showConfirmDialog(
    'Deletar Usuário',
    'Tem certeza? Esta ação não pode ser desfeita.'
  );

  if (!confirmed) return;

  try {
    await fetch(`/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    showSuccess('Usuário deletado com sucesso');
    refreshUserList();
  } catch (error) {
    showError('Erro ao deletar usuário');
  }
};
```

---

## 🎟️ Gestão de Cupons

### 1. Listar Cupons

**Endpoint:** `GET /coupons`
**Autenticação:** Bearer Token
**Permissões:** Todos os usuários autenticados

**Query Parameters:**
```typescript
interface ListCouponsQuery {
  page?: number;          // Página (padrão: 1)
  limit?: number;         // Itens por página (padrão: 50)
  isActive?: boolean;     // Filtrar por status ativo
  ownerId?: string;       // Filtrar por proprietário
  discountType?: 'percentage' | 'fixed';  // Filtrar por tipo de desconto
  search?: string;        // Buscar por código ou descrição
}
```

**Response (200):**
```typescript
interface ListCouponsResponse {
  coupons: Array<{
    id: string;                    // UUID
    code: string;                  // Código do cupom (único)
    description?: string | null;   // Descrição
    discountType: 'percentage' | 'fixed';  // Tipo de desconto
    discountValue: number;         // Valor do desconto
    maxUses?: number | null;       // Máximo de usos (null = ilimitado)
    currentUses: number;           // Usos atuais
    userId?: string | null;        // ID do usuário vinculado (uso único)
    ownerId?: string | null;       // ID do proprietário/criador
    validFrom?: string | null;     // Data início validade (ISO 8601)
    validUntil?: string | null;    // Data fim validade (ISO 8601)
    isActive: boolean;             // Se o cupom está ativo
    minPurchaseAmount?: number | null;  // Valor mínimo de compra
    createdAt: string;             // Data de criação
    updatedAt: string;             // Última atualização
    owner?: {                      // Info do proprietário (se houver)
      id: string;
      name: string;
      email: string;
    };
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}
```

**Exemplo de Uso:**

```typescript
// Componente de lista de cupons
const CouponList = () => {
  const [coupons, setCoupons] = useState([]);
  const [filters, setFilters] = useState({
    isActive: true,
    page: 1
  });

  useEffect(() => {
    const fetchCoupons = async () => {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        isActive: filters.isActive.toString()
      });

      const response = await fetch(`/coupons?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      setCoupons(data.coupons);
    };

    fetchCoupons();
  }, [filters]);

  return (
    <div>
      {coupons.map(coupon => (
        <CouponCard key={coupon.id} coupon={coupon} />
      ))}
    </div>
  );
};
```

---

### 2. Buscar Cupom por ID

**Endpoint:** `GET /coupons/:id`
**Autenticação:** Bearer Token

**Response (200):**
```typescript
interface GetCouponResponse {
  id: string;
  code: string;
  description?: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses?: number | null;
  currentUses: number;
  userId?: string | null;
  ownerId?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive: boolean;
  minPurchaseAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    roleId: string;
  };
  user?: {                    // Usuário vinculado (se cupom de uso único)
    id: string;
    name: string;
    email: string;
  };
  shares?: Array<{            // Compartilhamentos (se houver)
    id: string;
    sharedWithUserId: string;
    sharedWithUser: {
      id: string;
      name: string;
      email: string;
    };
    canViewStats: boolean;
    canDeactivate: boolean;
    sharedAt: string;
  }>;
}
```

---

### 3. Criar Cupom

**Endpoint:** `POST /coupons`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin, partner (próprios cupons)

**Request Body:**
```typescript
interface CreateCouponRequest {
  code: string;                    // Código único (obrigatório, max 50 chars)
  description?: string;            // Descrição (opcional, max 255 chars)
  discountType: 'percentage' | 'fixed';  // Tipo de desconto (obrigatório)
  discountValue: number;           // Valor (obrigatório, > 0)
  maxUses?: number;                // Máximo de usos (opcional, null = ilimitado)
  userId?: string;                 // Vincular a usuário específico (opcional)
  ownerId?: string;                // Proprietário (opcional, auto-preenchido se partner)
  validFrom?: string;              // Início validade ISO 8601 (opcional)
  validUntil?: string;             // Fim validade ISO 8601 (opcional)
  isActive?: boolean;              // Ativo (opcional, padrão: true)
  minPurchaseAmount?: number;      // Valor mínimo compra (opcional)
}
```

**Validações:**
- `code`: Único, máximo 50 caracteres, obrigatório
- `discountType`: Deve ser 'percentage' ou 'fixed'
- `discountValue`: Maior que 0, se percentage deve ser ≤ 100
- `validFrom` e `validUntil`: validFrom deve ser anterior a validUntil
- `maxUses`: Deve ser > 0 se fornecido
- `minPurchaseAmount`: Deve ser ≥ 0

**Response (201):**
```typescript
interface CreateCouponResponse {
  message: "Cupom criado com sucesso";
  coupon: {
    id: string;                    // UUID gerado
    code: string;
    description?: string | null;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    maxUses?: number | null;
    currentUses: 0;                // Sempre 0 para novo cupom
    userId?: string | null;
    ownerId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive: boolean;
    minPurchaseAmount?: number | null;
    createdAt: string;
  };
}
```

**Validation Errors (400):**
```typescript
interface CouponValidationError {
  error: "Validation error";
  details: Array<{
    field: string;
    message: string;
  }>;
}

// Exemplos:
{
  error: "Validation error",
  details: [
    { field: "code", message: "Código já existe" },
    { field: "discountValue", message: "Desconto percentual não pode ser maior que 100" },
    { field: "validUntil", message: "Data final deve ser posterior à data inicial" }
  ]
}
```

**Exemplo de Uso:**

```typescript
// Formulário de criação de cupom
const CreateCouponForm = () => {
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10,
    description: '',
    validFrom: '',
    validUntil: '',
    maxUses: undefined,
    minPurchaseAmount: undefined
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/coupons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        // Mostrar erros de validação
        setErrors(error.details);
        return;
      }

      const data = await response.json();
      showSuccess(`Cupom ${data.coupon.code} criado com sucesso!`);
      router.push('/coupons');
    } catch (error) {
      showError('Erro ao criar cupom');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Código do cupom"
        value={formData.code}
        onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
        maxLength={50}
        required
      />

      <select
        value={formData.discountType}
        onChange={(e) => setFormData({...formData, discountType: e.target.value})}
      >
        <option value="percentage">Percentual (%)</option>
        <option value="fixed">Valor Fixo (R$)</option>
      </select>

      <input
        type="number"
        placeholder="Valor do desconto"
        value={formData.discountValue}
        onChange={(e) => setFormData({...formData, discountValue: parseFloat(e.target.value)})}
        min="0"
        max={formData.discountType === 'percentage' ? 100 : undefined}
        step="0.01"
        required
      />

      <button type="submit">Criar Cupom</button>
    </form>
  );
};
```

---

### 4. Atualizar Cupom

**Endpoint:** `PUT /coupons/:id`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin, owner do cupom

**Request Body (todos campos opcionais):**
```typescript
interface UpdateCouponRequest {
  code?: string;
  description?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  maxUses?: number;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;              // Ativar/desativar cupom
  minPurchaseAmount?: number;
}
```

**Response (200):**
```typescript
interface UpdateCouponResponse {
  message: "Cupom atualizado com sucesso";
  coupon: {
    id: string;
    code: string;
    description?: string | null;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    maxUses?: number | null;
    currentUses: number;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive: boolean;
    minPurchaseAmount?: number | null;
    updatedAt: string;
  };
}
```

**Exemplo de Uso:**

```typescript
// Ativar/Desativar cupom
const toggleCouponStatus = async (couponId: string, currentStatus: boolean) => {
  const newStatus = !currentStatus;

  const response = await fetch(`/coupons/${couponId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ isActive: newStatus })
  });

  const data = await response.json();
  showSuccess(`Cupom ${newStatus ? 'ativado' : 'desativado'} com sucesso`);
  return data.coupon;
};
```

---

### 5. Deletar Cupom

**Endpoint:** `DELETE /coupons/:id`
**Autenticação:** Bearer Token
**Permissões:** super_admin, admin, owner do cupom

**Response (200):**
```typescript
interface DeleteCouponResponse {
  message: "Cupom deletado com sucesso";
  deletedCouponId: string;
  deletedCode: string;
}
```

**Error (400):**
```typescript
interface DeleteCouponError {
  error: "Cannot delete active coupon";
  message: "Não é possível deletar cupom ativo. Desative-o primeiro.";
}
```

---

## 🤝 Compartilhamento de Cupons (Partners)

### 1. Compartilhar Cupom com Partner

Permite que um admin/super_admin compartilhe um cupom com um usuário do tipo partner.

**Endpoint:** `POST /coupons/:couponId/share`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin, owner do cupom

**Request Body:**
```typescript
interface ShareCouponRequest {
  userId: string;              // ID do partner que receberá acesso
  canViewStats?: boolean;      // Pode ver estatísticas (padrão: true)
  canDeactivate?: boolean;     // Pode desativar cupom (padrão: false)
}
```

**Response (201):**
```typescript
interface ShareCouponResponse {
  message: "Cupom compartilhado com sucesso";
  share: {
    id: string;                // UUID do compartilhamento
    couponId: string;
    sharedWithUserId: string;
    sharedByUserId: string;    // Quem compartilhou
    canViewStats: boolean;
    canDeactivate: boolean;
    sharedAt: string;          // ISO 8601
    sharedWithUser: {
      id: string;
      name: string;
      email: string;
      roleId: string;
    };
  };
}
```

**Error (400):**
```typescript
interface ShareCouponError {
  error: "Already shared" | "Invalid user" | "Not a partner";
  message: string;
}

// Exemplos:
{ error: "Already shared", message: "Cupom já compartilhado com este usuário" }
{ error: "Invalid user", message: "Usuário não encontrado" }
{ error: "Not a partner", message: "Usuário não é um partner" }
```

**Exemplo de Uso:**

```typescript
// Modal de compartilhamento
const ShareCouponModal = ({ couponId }: { couponId: string }) => {
  const [selectedPartner, setSelectedPartner] = useState('');
  const [permissions, setPermissions] = useState({
    canViewStats: true,
    canDeactivate: false
  });

  const shareCoupon = async () => {
    try {
      const response = await fetch(`/coupons/${couponId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedPartner,
          ...permissions
        })
      });

      const data = await response.json();
      showSuccess(`Cupom compartilhado com ${data.share.sharedWithUser.name}`);
      closeModal();
    } catch (error) {
      showError('Erro ao compartilhar cupom');
    }
  };

  return (
    <div>
      <h3>Compartilhar Cupom</h3>
      <PartnerSelect value={selectedPartner} onChange={setSelectedPartner} />

      <label>
        <input
          type="checkbox"
          checked={permissions.canViewStats}
          onChange={(e) => setPermissions({...permissions, canViewStats: e.target.checked})}
        />
        Permitir visualizar estatísticas
      </label>

      <label>
        <input
          type="checkbox"
          checked={permissions.canDeactivate}
          onChange={(e) => setPermissions({...permissions, canDeactivate: e.target.checked})}
        />
        Permitir desativar cupom
      </label>

      <button onClick={shareCoupon}>Compartilhar</button>
    </div>
  );
};
```

---

### 2. Remover Compartilhamento

**Endpoint:** `DELETE /coupons/:couponId/share/:userId`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin, owner do cupom

**Response (200):**
```typescript
interface UnshareResponse {
  message: "Compartilhamento removido com sucesso";
  removedShareId: string;
}
```

---

### 3. Listar Compartilhamentos de um Cupom

**Endpoint:** `GET /coupons/:couponId/shares`
**Autenticação:** Bearer Token
**Permissões:** admin, super_admin, owner, partners com acesso

**Response (200):**
```typescript
interface ListSharesResponse {
  shares: Array<{
    id: string;
    couponId: string;
    sharedWithUserId: string;
    sharedByUserId: string;
    canViewStats: boolean;
    canDeactivate: boolean;
    sharedAt: string;
    sharedWithUser: {
      id: string;
      name: string;
      email: string;
      roleId: string;
    };
    sharedByUser: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}
```

---

### 4. Listar Cupons Compartilhados Comigo (Partner)

Lista todos os cupons que foram compartilhados com o usuário logado (partner).

**Endpoint:** `GET /partner/coupons`
**Autenticação:** Bearer Token
**Permissões:** partner, admin, super_admin

**Response (200):**
```typescript
interface PartnerCouponsResponse {
  coupons: Array<{
    id: string;
    code: string;
    description?: string | null;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    isActive: boolean;
    validFrom?: string | null;
    validUntil?: string | null;
    share: {                   // Informação do compartilhamento
      id: string;
      canViewStats: boolean;
      canDeactivate: boolean;
      sharedAt: string;
      sharedByUser: {
        id: string;
        name: string;
        email: string;
      };
    };
    statistics?: {             // Apenas se canViewStats = true
      totalUses: number;
      currentUses: number;
      remainingUses?: number | null;
    };
  }>;
}
```

**Exemplo de Uso:**

```typescript
// Dashboard do Partner
const PartnerDashboard = () => {
  const [sharedCoupons, setSharedCoupons] = useState([]);

  useEffect(() => {
    const fetchSharedCoupons = async () => {
      const response = await fetch('/partner/coupons', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      setSharedCoupons(data.coupons);
    };

    fetchSharedCoupons();
  }, []);

  return (
    <div>
      <h2>Meus Cupons</h2>
      {sharedCoupons.map(coupon => (
        <CouponCard key={coupon.id}>
          <h3>{coupon.code}</h3>
          <p>Desconto: {coupon.discountValue}{coupon.discountType === 'percentage' ? '%' : 'R$'}</p>

          {coupon.share.canViewStats && coupon.statistics && (
            <div>
              <p>Usos: {coupon.statistics.currentUses}/{coupon.statistics.totalUses || '∞'}</p>
            </div>
          )}

          {coupon.share.canDeactivate && (
            <button onClick={() => toggleCoupon(coupon.id)}>
              {coupon.isActive ? 'Desativar' : 'Ativar'}
            </button>
          )}

          <small>Compartilhado por: {coupon.share.sharedByUser.name}</small>
        </CouponCard>
      ))}
    </div>
  );
};
```

---

## 🔐 Gestão de Senha

### 1. Trocar Senha no Primeiro Acesso (Obrigatório)

**Endpoint:** `POST /auth/first-access/change-password`
**Autenticação:** Não (usa email + senha antiga)
**Público:** Sim

**Request Body:**
```typescript
interface FirstAccessChangePasswordRequest {
  email: string;               // Email do usuário
  oldPassword: string;         // Senha temporária recebida
  newPassword: string;         // Nova senha (mín 6 caracteres)
  confirmPassword: string;     // Confirmação da nova senha
}
```

**Validações:**
- `newPassword` deve ter mínimo 6 caracteres
- `newPassword` deve ser igual a `confirmPassword`
- `newPassword` deve ser diferente de `oldPassword`
- `oldPassword` deve estar correto

**Response (200):**
```typescript
interface FirstAccessChangePasswordResponse {
  message: "Senha alterada com sucesso";
  user: {
    id: string;
    name: string;
    email: string;
    isFirstAccess: false;      // Agora é false
    passwordChangedAt: string; // Timestamp da troca
  };
  token: string;               // Novo token JWT para login automático
}
```

**Error (400):**
```typescript
interface PasswordChangeError {
  error: "Validation error" | "Invalid credentials" | "Same password";
  message: string;
}

// Exemplos:
{ error: "Invalid credentials", message: "Senha antiga incorreta" }
{ error: "Validation error", message: "As senhas não coincidem" }
{ error: "Same password", message: "A nova senha deve ser diferente da antiga" }
```

**Exemplo de Uso:**

```typescript
// Tela de primeiro acesso (obrigatória após primeiro login)
const FirstAccessPage = ({ email }: { email: string }) => {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validações no frontend
    setErrors([]);
    const newErrors: string[] = [];

    if (formData.newPassword.length < 6) {
      newErrors.push('A senha deve ter no mínimo 6 caracteres');
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.push('As senhas não coincidem');
    }

    if (formData.newPassword === formData.oldPassword) {
      newErrors.push('A nova senha deve ser diferente da senha atual');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const response = await fetch('/auth/first-access/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          ...formData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        setErrors([error.message]);
        return;
      }

      const data = await response.json();

      // Salvar token e fazer login automático
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      showSuccess('Senha alterada com sucesso! Redirecionando...');

      // Redirecionar para dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (error) {
      setErrors(['Erro ao alterar senha. Tente novamente.']);
    }
  };

  return (
    <div className="first-access-container">
      <h2>Primeiro Acesso</h2>
      <p>Por segurança, você precisa alterar sua senha temporária.</p>

      <form onSubmit={handleSubmit}>
        {errors.length > 0 && (
          <div className="error-box">
            {errors.map((error, i) => (
              <p key={i}>{error}</p>
            ))}
          </div>
        )}

        <input
          type="password"
          placeholder="Senha temporária"
          value={formData.oldPassword}
          onChange={(e) => setFormData({...formData, oldPassword: e.target.value})}
          required
          autoFocus
        />

        <input
          type="password"
          placeholder="Nova senha (mín 6 caracteres)"
          value={formData.newPassword}
          onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
          required
          minLength={6}
        />

        <input
          type="password"
          placeholder="Confirmar nova senha"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
          required
        />

        <button type="submit">Alterar Senha e Continuar</button>
      </form>
    </div>
  );
};
```

---

### 2. Esqueci Minha Senha (Solicitar Reset)

**Endpoint:** `POST /auth/forgot-password`
**Autenticação:** Não
**Público:** Sim
**Rate Limit:** 3 requisições por hora por email

**Request Body:**
```typescript
interface ForgotPasswordRequest {
  email: string;               // Email do usuário
}
```

**Response (200):**
```typescript
interface ForgotPasswordResponse {
  message: "Email de recuperação enviado com sucesso";
  email: string;
  // Em desenvolvimento, retorna o token:
  resetToken?: string;         // Apenas em NODE_ENV=development
  expiresIn: "1 hour";
}
```

**Nota:** Em produção, o token é enviado por email. Em desenvolvimento, o token é retornado na resposta para facilitar testes.

**Error (404):**
```typescript
interface UserNotFoundError {
  error: "User not found";
  message: "Email não encontrado no sistema";
}
```

**Exemplo de Uso:**

```typescript
// Tela "Esqueci minha senha"
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState(''); // Apenas dev

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        showError(error.message);
        return;
      }

      const data = await response.json();
      setSent(true);

      // Em desenvolvimento, mostrar token (em produção vai por email)
      if (data.resetToken) {
        setResetToken(data.resetToken);
      }

    } catch (error) {
      showError('Erro ao enviar email de recuperação');
    }
  };

  if (sent) {
    return (
      <div>
        <h2>Email Enviado!</h2>
        <p>Verifique sua caixa de entrada em {email}</p>
        <p>O link de recuperação expira em 1 hora.</p>

        {/* Apenas em desenvolvimento: */}
        {resetToken && (
          <div className="dev-only">
            <p><strong>DEV:</strong> Token de reset:</p>
            <code>{resetToken}</code>
            <button onClick={() => router.push(`/reset-password?token=${resetToken}`)}>
              Ir para reset
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2>Esqueci Minha Senha</h2>
      <p>Digite seu email para receber instruções de recuperação.</p>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Seu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Enviar Email de Recuperação</button>
      </form>
    </div>
  );
};
```

---

### 3. Resetar Senha (Usar Token)

**Endpoint:** `POST /auth/reset-password`
**Autenticação:** Não (usa token de reset)
**Público:** Sim

**Request Body:**
```typescript
interface ResetPasswordRequest {
  token: string;               // Token recebido por email
  newPassword: string;         // Nova senha (mín 6 caracteres)
  confirmPassword: string;     // Confirmação
}
```

**Response (200):**
```typescript
interface ResetPasswordResponse {
  message: "Senha resetada com sucesso";
  user: {
    id: string;
    email: string;
    passwordChangedAt: string;
  };
}
```

**Error (400):**
```typescript
interface ResetPasswordError {
  error: "Invalid token" | "Token expired" | "Token already used" | "Validation error";
  message: string;
}

// Exemplos:
{ error: "Invalid token", message: "Token inválido ou não encontrado" }
{ error: "Token expired", message: "Token expirado. Solicite um novo." }
{ error: "Token already used", message: "Este token já foi utilizado" }
{ error: "Validation error", message: "As senhas não coincidem" }
```

**Exemplo de Uso:**

```typescript
// Tela de reset de senha (acessada via link do email)
const ResetPasswordPage = () => {
  const router = useRouter();
  const { token } = router.query; // Token vem da URL

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      showError('As senhas não coincidem');
      return;
    }

    if (formData.newPassword.length < 6) {
      showError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    try {
      const response = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...formData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        showError(error.message);
        return;
      }

      showSuccess('Senha alterada com sucesso!');

      // Redirecionar para login
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (error) {
      showError('Erro ao resetar senha');
    }
  };

  return (
    <div>
      <h2>Criar Nova Senha</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Nova senha (mín 6 caracteres)"
          value={formData.newPassword}
          onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
          required
          minLength={6}
        />

        <input
          type="password"
          placeholder="Confirmar nova senha"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
          required
        />

        <button type="submit">Resetar Senha</button>
      </form>
    </div>
  );
};
```

---

### 4. Alterar Senha (Usuário Logado)

**Endpoint:** `POST /auth/change-password`
**Autenticação:** Bearer Token
**Permissões:** Qualquer usuário autenticado

**Request Body:**
```typescript
interface ChangePasswordRequest {
  currentPassword: string;     // Senha atual
  newPassword: string;         // Nova senha (mín 6 caracteres)
  confirmPassword: string;     // Confirmação
}
```

**Response (200):**
```typescript
interface ChangePasswordResponse {
  message: "Senha alterada com sucesso";
  passwordChangedAt: string;   // Timestamp da alteração
}
```

**Error (401):**
```typescript
interface ChangePasswordError {
  error: "Invalid password";
  message: "Senha atual incorreta";
}
```

**Exemplo de Uso:**

```typescript
// Página de configurações - Alterar senha
const ChangePasswordSection = () => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validações
    if (formData.newPassword !== formData.confirmPassword) {
      showError('As senhas não coincidem');
      return;
    }

    if (formData.newPassword.length < 6) {
      showError('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (formData.newPassword === formData.currentPassword) {
      showError('A nova senha deve ser diferente da atual');
      return;
    }

    try {
      const response = await fetch('/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        showError(error.message);
        return;
      }

      showSuccess('Senha alterada com sucesso!');

      // Limpar formulário
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

    } catch (error) {
      showError('Erro ao alterar senha');
    }
  };

  return (
    <div className="settings-section">
      <h3>Alterar Senha</h3>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Senha atual"
          value={formData.currentPassword}
          onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
          required
        />

        <input
          type="password"
          placeholder="Nova senha"
          value={formData.newPassword}
          onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
          required
          minLength={6}
        />

        <input
          type="password"
          placeholder="Confirmar nova senha"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
          required
        />

        <button type="submit">Alterar Senha</button>
      </form>
    </div>
  );
};
```

---

## 📊 Modelos de Dados

### User (Usuário)

```typescript
interface User {
  id: string;                      // UUID
  name: string;                    // Nome completo
  email: string;                   // Email único
  passwordHash: string;            // Hash bcrypt (nunca retornado na API)
  roleId: string;                  // super_admin | admin | contract_manager | partner | user
  contractId?: string | null;      // ID do contrato (opcional)
  isFirstAccess: boolean;          // true até primeira troca de senha
  passwordChangedAt?: string | null;  // Última troca de senha
  lastLoginAt?: string | null;     // Último login
  createdAt: string;               // Data de criação
  updatedAt: string;               // Última atualização

  // Relações (quando expandidas)
  role?: Role;
  contract?: Contract;
}
```

### Role (Perfil de Acesso)

```typescript
interface Role {
  id: string;                      // super_admin | admin | contract_manager | partner | user
  name: string;                    // Nome amigável
  description: string;             // Descrição do role
  level: number;                   // Nível de hierarquia (0-4)
  createdAt: string;

  // Relações
  permissions?: Permission[];      // Permissões associadas
}
```

### Permission (Permissão)

```typescript
interface Permission {
  id: string;                      // users.create | coupons.delete | etc
  resource: string;                // users | coupons | contracts | etc
  action: string;                  // create | read | update | delete | share
  description: string;
  createdAt: string;
}
```

### Coupon (Cupom)

```typescript
interface Coupon {
  id: string;                      // UUID
  code: string;                    // Código único (max 50 chars)
  description?: string | null;     // Descrição (max 255 chars)
  discountType: 'percentage' | 'fixed';  // Tipo de desconto
  discountValue: number;           // Valor do desconto (0-100 para %, qualquer para fixed)
  maxUses?: number | null;         // Máximo de usos (null = ilimitado)
  currentUses: number;             // Contador de usos
  userId?: string | null;          // Usuário específico (cupom de uso único)
  ownerId?: string | null;         // Proprietário/criador
  validFrom?: string | null;       // Início da validade (ISO 8601)
  validUntil?: string | null;      // Fim da validade (ISO 8601)
  isActive: boolean;               // Ativo/inativo
  minPurchaseAmount?: number | null;  // Valor mínimo de compra
  createdAt: string;
  updatedAt: string;

  // Relações (quando expandidas)
  owner?: User;
  user?: User;
  shares?: CouponShare[];
}
```

### CouponShare (Compartilhamento de Cupom)

```typescript
interface CouponShare {
  id: string;                      // UUID
  couponId: string;                // ID do cupom
  sharedWithUserId: string;        // ID do usuário que recebeu
  sharedByUserId: string;          // ID do usuário que compartilhou
  canViewStats: boolean;           // Pode ver estatísticas
  canDeactivate: boolean;          // Pode desativar cupom
  sharedAt: string;                // Data do compartilhamento

  // Relações
  coupon?: Coupon;
  sharedWithUser?: User;
  sharedByUser?: User;
}
```

### Contract (Contrato)

```typescript
interface Contract {
  id: string;                      // UUID
  name: string;                    // Nome do contrato
  active: boolean;                 // Ativo/inativo
  startDate?: string | null;       // Data de início
  endDate?: string | null;         // Data de término
  createdAt: string;
  updatedAt: string;

  // Relações
  users?: User[];                  // Usuários vinculados
}
```

### PasswordResetToken (Token de Reset de Senha)

```typescript
interface PasswordResetToken {
  id: string;                      // UUID
  userId: string;                  // ID do usuário
  token: string;                   // Token SHA256 (nunca retornado direto)
  expiresAt: string;               // Data de expiração (1 hora)
  usedAt?: string | null;          // Data de uso (null = não usado)
  createdAt: string;

  // Relações
  user?: User;
}
```

---

## ⚠️ Códigos de Erro

### HTTP Status Codes

| Status | Significado | Quando Ocorre |
|--------|-------------|---------------|
| 200 | OK | Requisição bem-sucedida |
| 201 | Created | Recurso criado com sucesso |
| 400 | Bad Request | Dados inválidos, validação falhou |
| 401 | Unauthorized | Token inválido ou ausente |
| 403 | Forbidden | Sem permissão para acessar recurso |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito (ex: email duplicado) |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Internal Server Error | Erro interno do servidor |

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;                   // Código do erro (machine-readable)
  message: string;                 // Mensagem amigável (user-readable)
  details?: Array<{                // Detalhes de validação (opcional)
    field: string;
    message: string;
  }>;
  statusCode?: number;             // Código HTTP (opcional)
}
```

### Exemplos de Erros Comuns

```typescript
// 401 - Token inválido
{
  "error": "Unauthorized",
  "message": "Token inválido ou expirado",
  "statusCode": 401
}

// 400 - Validação falhou
{
  "error": "Validation error",
  "message": "Dados inválidos",
  "details": [
    { "field": "email", "message": "Email já cadastrado" },
    { "field": "password", "message": "Senha deve ter no mínimo 6 caracteres" }
  ],
  "statusCode": 400
}

// 403 - Sem permissão
{
  "error": "Forbidden",
  "message": "Você não tem permissão para executar esta ação",
  "statusCode": 403
}

// 404 - Não encontrado
{
  "error": "Not found",
  "message": "Recurso não encontrado",
  "statusCode": 404
}

// 429 - Rate limit
{
  "error": "Too many requests",
  "message": "Muitas requisições. Tente novamente em 1 minuto",
  "statusCode": 429
}
```

---

## 🔄 Fluxos Completos

### Fluxo 1: Onboarding de Novo Usuário

```typescript
// 1. Admin cria usuário com senha temporária
const newUser = await createUser({
  name: "João Silva",
  email: "joao@exemplo.com",
  password: "temp123456",  // Senha temporária
  roleId: "partner"
});

// 2. Sistema envia email com senha temporária (backend automático)
// Email: "Sua senha temporária é: temp123456"

// 3. Usuário tenta fazer login pela primeira vez
const loginResponse = await login({
  email: "joao@exemplo.com",
  password: "temp123456"
});

// 4. Sistema detecta primeiro acesso e retorna 403
if (loginResponse.status === 403) {
  // Redirecionar para tela de troca de senha obrigatória
  router.push('/first-access-change-password');
}

// 5. Usuário troca senha obrigatoriamente
const changeResponse = await firstAccessChangePassword({
  email: "joao@exemplo.com",
  oldPassword: "temp123456",
  newPassword: "minhasenhasegura123",
  confirmPassword: "minhasenhasegura123"
});

// 6. Sistema retorna token JWT e faz login automático
localStorage.setItem('authToken', changeResponse.token);
router.push('/dashboard');
```

### Fluxo 2: Recuperação de Senha

```typescript
// 1. Usuário esqueceu senha e solicita reset
const forgotResponse = await forgotPassword({
  email: "joao@exemplo.com"
});

// 2. Sistema envia email com link de reset
// Email: "Clique aqui para resetar sua senha: https://app.com/reset?token=abc123"

// 3. Usuário clica no link (token válido por 1 hora)
// URL: /reset-password?token=abc123

// 4. Usuário define nova senha
const resetResponse = await resetPassword({
  token: "abc123",
  newPassword: "novasenhasegura456",
  confirmPassword: "novasenhasegura456"
});

// 5. Redirecionar para login
router.push('/login');
showSuccess('Senha alterada! Faça login com sua nova senha.');
```

### Fluxo 3: Criação e Compartilhamento de Cupom

```typescript
// 1. Admin cria cupom
const coupon = await createCoupon({
  code: "BLACKFRIDAY50",
  description: "50% de desconto Black Friday",
  discountType: "percentage",
  discountValue: 50,
  maxUses: 100,
  validFrom: "2024-11-24T00:00:00Z",
  validUntil: "2024-11-30T23:59:59Z",
  isActive: true
});

// 2. Admin compartilha cupom com partners
const share1 = await shareCoupon(coupon.id, {
  userId: "partner-id-1",
  canViewStats: true,
  canDeactivate: false
});

const share2 = await shareCoupon(coupon.id, {
  userId: "partner-id-2",
  canViewStats: true,
  canDeactivate: true  // Este partner pode desativar
});

// 3. Partner faz login e vê cupons compartilhados
const partnerCoupons = await getPartnerCoupons();
// Retorna: [{ code: "BLACKFRIDAY50", share: { canViewStats: true, ... } }]

// 4. Partner verifica estatísticas (se permitido)
if (partnerCoupons[0].share.canViewStats) {
  console.log(`Usos: ${partnerCoupons[0].statistics.currentUses}/100`);
}

// 5. Partner desativa cupom (se permitido)
if (partnerCoupons[0].share.canDeactivate) {
  await updateCoupon(coupon.id, { isActive: false });
}
```

### Fluxo 4: Autenticação e Uso de Token

```typescript
// 1. Login
const { token, user } = await login({
  email: "admin@exemplo.com",
  password: "senha123"
});

// 2. Armazenar token
localStorage.setItem('authToken', token);
localStorage.setItem('user', JSON.stringify(user));

// 3. Fazer requisições autenticadas
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('authToken');

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
};

// 4. Usar em requisições
const users = await fetchWithAuth('/users').then(r => r.json());
const coupons = await fetchWithAuth('/coupons').then(r => r.json());

// 5. Tratar erro 401 (token expirado)
const response = await fetchWithAuth('/users');
if (response.status === 401) {
  // Token expirado, fazer logout
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  router.push('/login');
  showError('Sessão expirada. Faça login novamente.');
}

// 6. Logout
const logout = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  router.push('/login');
};
```

---

## 🎨 Recomendações para UI/UX

### 1. Feedback Visual

```typescript
// Sempre mostrar feedback ao usuário
const showSuccess = (message: string) => {
  // Toast verde com ícone de check
  toast.success(message, { duration: 3000 });
};

const showError = (message: string) => {
  // Toast vermelho com ícone de erro
  toast.error(message, { duration: 5000 });
};

const showWarning = (message: string) => {
  // Toast amarelo com ícone de aviso
  toast.warning(message, { duration: 4000 });
};
```

### 2. Loading States

```typescript
// Sempre mostrar loading durante requisições
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  setLoading(true);
  try {
    await someApiCall();
    showSuccess('Operação concluída!');
  } catch (error) {
    showError('Erro na operação');
  } finally {
    setLoading(false);
  }
};

return (
  <button onClick={handleAction} disabled={loading}>
    {loading ? <Spinner /> : 'Salvar'}
  </button>
);
```

### 3. Validação de Formulários

```typescript
// Validar no frontend antes de enviar
const validateForm = (data: any) => {
  const errors: Record<string, string> = {};

  if (!data.email || !/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Email inválido';
  }

  if (!data.password || data.password.length < 6) {
    errors.password = 'Senha deve ter no mínimo 6 caracteres';
  }

  return errors;
};

// Mostrar erros no formulário
const [errors, setErrors] = useState({});

const handleSubmit = async (formData: any) => {
  const validationErrors = validateForm(formData);

  if (Object.keys(validationErrors).length > 0) {
    setErrors(validationErrors);
    return;
  }

  // Enviar para API...
};
```

### 4. Confirmações Destrutivas

```typescript
// Sempre pedir confirmação para ações destrutivas
const handleDelete = async (id: string) => {
  const confirmed = await showConfirmDialog({
    title: 'Confirmar Exclusão',
    message: 'Tem certeza? Esta ação não pode ser desfeita.',
    confirmText: 'Sim, deletar',
    cancelText: 'Cancelar',
    type: 'danger'
  });

  if (!confirmed) return;

  // Prosseguir com exclusão...
};
```

### 5. Paginação

```typescript
// Implementar paginação para listas grandes
const UserList = () => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ users: [], pagination: {} });

  useEffect(() => {
    fetchUsers({ page, limit: 20 }).then(setData);
  }, [page]);

  return (
    <div>
      {data.users.map(user => <UserCard key={user.id} user={user} />)}

      <Pagination
        currentPage={data.pagination.currentPage}
        totalPages={data.pagination.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
};
```

---

## 🔐 Segurança

### Headers de Segurança

```typescript
// Sempre incluir headers de segurança
const secureHeaders = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
};
```

### Sanitização de Inputs

```typescript
// Sanitizar inputs do usuário
import DOMPurify from 'dompurify';

const sanitizeInput = (input: string) => {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

// Usar em formulários
const handleSubmit = (formData: any) => {
  const sanitized = {
    name: sanitizeInput(formData.name),
    description: sanitizeInput(formData.description)
  };

  // Enviar dados sanitizados...
};
```

### CSRF Protection

```typescript
// Token JWT já oferece proteção contra CSRF
// Mas sempre validar origem das requisições no backend
```

---

## 📝 Notas Finais

### Rate Limiting

- Login: 5 tentativas por minuto
- Forgot Password: 3 solicitações por hora por email
- Demais endpoints: 100 requisições por minuto

### Token JWT

- Expiração: 1 hora (configurável via JWT_EXPIRES_IN)
- Refresh: Não implementado (fazer novo login)
- Algoritmo: HS256

### Timezone

- Todas as datas em UTC (ISO 8601)
- Converter para timezone local no frontend

### Versionamento da API

- Versão atual: 1.0.0
- Breaking changes serão comunicados com antecedência
- Manter compatibilidade com versões antigas quando possível

---

**Última Atualização:** 2024-12-12
**Mantido por:** Storm Education Backend Team
**Contato:** projetos@stormeducation.com.br
