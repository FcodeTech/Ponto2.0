# 🕐 Sistema de Ponto Eletrônico

> Sistema web completo de controle de ponto eletrônico, desenvolvido com HTML, CSS e JavaScript puro, utilizando IndexedDB (via Dexie.js) para persistência local de dados — sem necessidade de servidor ou banco de dados externo.

---

## ✨ Funcionalidades

### 👤 Autenticação
- Tela de login com suporte a branding personalizado (logo + nome do sistema)
- Controle de sessão por `sessionStorage`
- Dois níveis de acesso: **Administrador** e **Funcionário**

### 📊 Dashboard
- Visão geral de horas trabalhadas, horas extras 50%, horas extras 100%, salário base e total a receber
- Filtros persistentes por **funcionário**, **mês**, **data inicial** e **data final**
- Os filtros são salvos no `localStorage` e permanecem ao recarregar a página

### 🕒 Registrar Ponto
- Registro de entrada, início de pausa, retorno de pausa e saída
- Relógio em tempo real
- Seleção de **tipo de jornada** (8h, 7h20, 4h, Extras)
- Seleção de **tipo de hora extra** (50% ou 100%)
- Cálculo automático baseado nas regras da **CLT (Art. 58, §1º)** — tolerância de 10 minutos
- Modo de **edição de registros** existentes via redirecionamento da tela de Relatórios

### 👥 Funcionários (Administrador)
- Cadastro completo: nome, e-mail, CPF, matrícula, senha, nível de acesso
- Configuração de jornada padrão, tipo de hora extra e salário base
- Cor de perfil personalizada
- Interface totalmente **responsiva** (cards em mobile)

### 📋 Relatórios (Administrador)
- Tabela de registros com filtros por funcionário, mês e período personalizado
- Filtros com **persistência via localStorage**
- Cards de totais: horas normais, extras 50%, extras 100%, valores financeiros
- **Editar** registro individual (redireciona para a tela de ponto)
- **Excluir** registro individual
- **Limpar todos** os registros de uma vez

### 📤 Exportação
- **PDF** profissional com cabeçalho, logotipo, tabela de registros e resumo financeiro
- **Excel (XLSX)** com todos os dados do período filtrado

### ⚙️ Configurações (Administrador)
- Definir o **nome do sistema** (aplicado em todas as telas e no relatório PDF)
- Fazer upload da **logotipo** (exibida no login, sidebar e dashboard)
- Alternar **tema claro/escuro**

---

## 🗂️ Estrutura do Projeto

```
app2/
├── index.html               # Dashboard principal
├── login.html               # Tela de login
├── registrar_ponto.html     # Tela de registro de ponto
├── funcionarios.html        # Gestão de funcionários
├── relatorios.html          # Relatórios e exportação
├── configuracoes.html       # Configurações do sistema
├── perfil.html              # Perfil do usuário
│
├── css/
│   └── styles.css           # Estilos globais + responsividade
│
└── js/
    ├── db.js                # Schema do banco (Dexie/IndexedDB)
    ├── auth.js              # Autenticação e controle de sessão
    ├── app.js               # Inicialização, tema, navegação
    ├── timeTracker.js       # Lógica de ponto e dashboard
    ├── reports.js           # Filtros e renderização de relatórios
    ├── export.js            # Exportação PDF e Excel
    ├── funcionarios.js      # CRUD de funcionários
    └── update_sidebar.js    # Utilitário de sidebar
```

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| HTML5 / CSS3 | Estrutura e estilização |
| JavaScript (ES2020+) | Lógica de negócio |
| Dexie.js | Wrapper do IndexedDB para persistência local |
| jsPDF + jspdf-autotable | Geração de PDF |
| SheetJS (xlsx) | Exportação para Excel |
| Font Awesome 6 | Ícones |
| localStorage | Persistência de filtros e preferências |
| sessionStorage | Controle de sessão do usuário logado |

---

## 🚀 Como Hospedar na Vercel

O projeto é 100% estático (sem backend), portanto é compatível com o plano gratuito da Vercel.

### Pré-requisitos
- Conta gratuita em https://vercel.com
- Conta no GitHub, GitLab ou Bitbucket
- Git instalado na sua máquina

---

### Passo 1 — Preparar o repositório Git

Abra o terminal na pasta do projeto e execute:

```bash
git init
git add .
git commit -m "feat: primeira versão do sistema de ponto"
```

Crie um repositório no GitHub e faça o push:

```bash
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git branch -M main
git push -u origin main
```

---

### Passo 2 — Importar na Vercel

1. Acesse https://vercel.com e faça login
2. Clique em **"Add New… → Project"**
3. Selecione **"Import Git Repository"**
4. Escolha o repositório que você criou
5. Na tela de configuração:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
   - **Build Command:** *(deixe em branco)*
   - **Output Directory:** *(deixe em branco)*
6. Clique em **"Deploy"**

Aguarde cerca de 30 segundos. A Vercel irá gerar um link público no formato:

```
https://seu-projeto.vercel.app
```

---

### Passo 3 — Domínio personalizado (opcional)

1. No painel da Vercel, acesse seu projeto
2. Clique em **"Settings → Domains"**
3. Adicione seu domínio (ex: `ponto.suaempresa.com.br`)
4. Aponte o DNS conforme as instruções da Vercel

---

### Atualizações futuras

Toda vez que você fizer um `git push` na branch `main`, a Vercel faz o **deploy automático** em segundos:

```bash
git add .
git commit -m "fix: descrição da mudança"
git push
```

---

## ⚠️ Observações Importantes

**Dados armazenados localmente:** O sistema usa IndexedDB (banco no navegador). Os dados ficam salvos **somente no dispositivo/navegador** onde o sistema for acessado. Não há sincronização entre dispositivos.

**Para uso em produção real** com múltiplos funcionários acessando de dispositivos diferentes, é necessário integrar um backend (ex: Firebase, Supabase ou uma API REST própria).

**Backup de dados:** Utilize a exportação para **PDF ou Excel** regularmente para guardar um histórico dos registros.

---

## 👨‍💻 Características

- Design moderno com suporte a tema escuro/claro
- Layout responsivo para mobile e desktop
- Controle de acesso por perfil (Admin / Funcionário)
- Cálculo automático de horas extras conforme a CLT
- Branding personalizável (nome e logo)

---

## 📄 Licença

Este projeto é de uso privado. Todos os direitos reservados.
