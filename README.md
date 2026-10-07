# Zelo — app instalável, fora do Claude

## O que já vem pronto
- Rotina, Tarefas, Orçamento, Metas, Saúde, Ideias, Pensamentos (com desenho) — tudo funciona 100% de graça, sem chave nenhuma.
- Instalável como app de verdade no Android/iOS (PWA), sem loja de aplicativo.

## O que precisa da sua chave de API (opcional)
- Checagem de foto (remédio/alimento), botão de voz, respostas do Zelo em Ideias/Pensamentos.
- Sem a chave, o app inteiro funciona normalmente — só essas partes ficam inativas até você configurar.

## ⚠️ Sobre a Agenda (Google/Microsoft)
A conexão que você tinha dentro do Claude **não é transferida automaticamente**. Fora do Claude, criar eventos
na Agenda exige configurar autenticação OAuth diretamente com o Google — isso é um passo técnico à parte,
ainda não incluído aqui. Trate como uma fase futura.

---

## Passo 1 — Testar no seu computador (opcional, mas recomendado)

Precisa ter o [Node.js](https://nodejs.org) instalado (baixe a versão "LTS").

```bash
cd zelo-app
npm install
npm run dev
```

Abre o link que aparecer (algo como `http://localhost:5173`) — o Zelo deve rodar igual ao que você já conhece.

## Passo 2 — Subir pro GitHub

```bash
cd zelo-app
git init
git add .
git commit -m "Zelo — primeira versão fora do Claude"
```

Agora vá em [github.com/new](https://github.com/new), crie um repositório novo (pode ser privado), **sem**
marcar "adicionar README" (já temos um). Copie os comandos que o GitHub mostrar depois de criar, algo como:

```bash
git remote add origin https://github.com/SEU-USUARIO/zelo-app.git
git branch -M main
git push -u origin main
```

## Passo 3 — Publicar no Vercel

1. Entre em [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
2. Clique em **"Add New" → "Project"**.
3. Escolha o repositório `zelo-app`.
4. Não precisa mudar nenhuma configuração — o Vercel já reconhece Vite sozinho.
5. Clique em **Deploy**.

Em cerca de 1 minuto você tem uma URL sua, tipo `zelo-app-seunome.vercel.app`.

## Passo 4 — Instalar no celular

1. Abra essa URL no **Chrome** do Android.
2. O Chrome deve mostrar um banner de **"Instalar aplicativo"** sozinho (ou toque nos ⋮ três pontinhos → "Instalar app").
3. Pronto — ícone na tela inicial, abre em tela cheia, sem barra de navegador.

## Passo 5 — Ativar a IA (opcional)

1. Crie uma conta em [console.anthropic.com](https://console.anthropic.com) e gere uma chave de API.
2. Abra o Zelo, toque no ⚙️ no canto inferior esquerdo, cole a chave, salve.
3. As funções de IA (foto, voz, Ideias/Pensamentos) voltam a funcionar.

## Ícones do app
Os arquivos `public/icon-192.png` e `public/icon-512.png` são placeholders simples. Troque por um ícone seu
(quadrado, fundo sólido, sem texto pequeno) pra ficar com uma cara mais profissional na tela inicial.

## Atualizações futuras
Sempre que o código mudar:
```bash
git add .
git commit -m "descrição da mudança"
git push
```
O Vercel republica sozinho. O app no celular atualiza na próxima vez que for aberto com internet.
