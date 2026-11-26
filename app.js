// Vitrine: lê apps.json e monta a loja (lista + página de cada app).
// Rotas por hash: "#/" = início, "#/app/<id>" = detalhe.
"use strict";

const TIPOS = {
  web: "Site",
  pwa: "App web instalável",
  android: "Android (APK)",
};
const STATUS = { beta: "Beta", encerrado: "Encerrado", pessoal: "Uso pessoal", estavel: "" };
const DIAS_NOVO = 14;

const ua = navigator.userAgent;
const PLATAFORMA = /Android/i.test(ua) ? "android"
  : (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) ? "ios"
  : "desktop";

let catalogo = null;
let filtro = { texto: "", categoria: "" };
let pedidoInstalacao = null;

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const conteudo = () => $("#conteudo");

function ultima(app) { return (app.versoes && app.versoes[0]) || {}; }

function dataBR(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function ehNovo(app) {
  const d = ultima(app).data;
  if (!d) return false;
  const dias = (Date.now() - new Date(d + "T00:00:00").getTime()) / 86400000;
  return dias >= 0 && dias <= DIAS_NOVO;
}

// Endereço para abrir o app no navegador (se houver).
function linkWeb(app) {
  if (app.pasta) return `apps/${encodeURIComponent(app.id)}/`;
  return (app.acesso && app.acesso.web) || "";
}
// Endereço do APK mais recente (se houver).
function linkApk(app) {
  for (const v of app.versoes || []) if (v.apk) return v.apk;
  return (app.acesso && app.acesso.android) || "";
}

function selos(app) {
  const s = [`<span class="selo">${esc(TIPOS[app.tipo] || app.tipo)}</span>`];
  if (ehNovo(app)) s.push(`<span class="selo novo">Atualizado</span>`);
  if (STATUS[app.status]) s.push(`<span class="selo ${esc(app.status)}">${esc(STATUS[app.status])}</span>`);
  return `<div class="selos">${s.join("")}</div>`;
}

// ---------- Início ----------
function telaInicio() {
  const apps = [...catalogo.apps].sort((a, b) => (ultima(b).data || "").localeCompare(ultima(a).data || ""));
  const usadas = [...new Set(apps.map((a) => a.categoria).filter(Boolean))];
  const nomeCat = (c) => (catalogo.categorias && catalogo.categorias[c]) || c;

  conteudo().innerHTML = `
    <label class="busca">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.2-1.6l.3.3v.8l5 5 1.5-1.5-5-5Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z"/></svg>
      <input id="campo-busca" type="search" placeholder="Buscar apps e sites" value="${esc(filtro.texto)}" aria-label="Buscar apps e sites">
    </label>
    <div class="filtros" role="group" aria-label="Categorias">
      <button class="chip" data-cat="" aria-pressed="${!filtro.categoria}">Todos</button>
      ${usadas.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${filtro.categoria === c}">${esc(nomeCat(c))}</button>`).join("")}
    </div>
    <h2 class="secao" id="titulo-lista"></h2>
    <div class="grade" id="grade"></div>`;

  const desenhar = () => {
    const t = filtro.texto.trim().toLowerCase();
    const lista = apps.filter((a) =>
      (!filtro.categoria || a.categoria === filtro.categoria) &&
      (!t || [a.nome, a.resumo, a.descricao, nomeCat(a.categoria)].join(" ").toLowerCase().includes(t)));
    $("#titulo-lista").textContent = filtro.categoria ? nomeCat(filtro.categoria) : "Todos os apps";
    $("#grade").innerHTML = lista.length ? lista.map((a) => `
      <a class="cartao" href="#/app/${encodeURIComponent(a.id)}">
        <img class="icone" src="${esc(a.icone)}" alt="" loading="lazy" width="64" height="64">
        <div class="info">
          <h3>${esc(a.nome)}</h3>
          <p>${esc(a.resumo)}</p>
          ${selos(a)}
        </div>
      </a>`).join("") : `<p class="vazio">Nada encontrado.</p>`;
  };

  $("#campo-busca").addEventListener("input", (e) => { filtro.texto = e.target.value; desenhar(); });
  conteudo().querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    filtro.categoria = b.dataset.cat;
    conteudo().querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    desenhar();
  }));
  desenhar();
  document.title = catalogo.loja.nome || "Vitrine";
}

// ---------- Detalhe ----------
function botoesAcao(app) {
  const web = linkWeb(app), apk = linkApk(app);
  const b = [];
  let nota = "";
  if (app.tipo === "android") {
    if (apk) b.push(`<a class="botao" href="${esc(apk)}" download>Baixar APK${(ultima(app).outros || []).length ? " (Padrão)" : ""}</a>`);
    else b.push(`<span class="botao" aria-disabled="true">APK ainda não publicado</span>`);
    for (const o of ultima(app).outros || []) b.push(`<a class="botao contorno" href="${esc(o.apk)}" download>Baixar edição ${esc(o.nome)}</a>`);
    if (PLATAFORMA === "ios") nota = "Este app é só para Android: arquivos APK não instalam no iPhone.";
    if (PLATAFORMA === "desktop") nota = "Para instalar no celular, aponte a câmera para o código abaixo.";
  }
  if (web) b.push(`<a class="botao ${app.tipo === "android" ? "contorno" : ""}" href="${esc(web)}" target="_blank" rel="noopener">${app.tipo === "android" ? "Abrir versão web" : "Abrir"}</a>`);
  if (app.codigo) b.push(`<a class="botao contorno" href="${esc(app.codigo)}" target="_blank" rel="noopener">Código-fonte</a>`);
  b.push(`<button class="botao contorno" id="compartilhar">Compartilhar</button>`);
  return `<div class="acoes">${b.join("")}</div>${nota ? `<p class="nota-plataforma">${esc(nota)}</p>` : ""}`;
}

function comoInstalar(app) {
  if (app.tipo === "android") {
    return `
      <ol class="passos">
        <li>No celular Android, toque em <strong>Baixar APK</strong>.</li>
        <li>Quando o download terminar, toque na notificação ou abra o arquivo na pasta <strong>Downloads</strong>.</li>
        <li>Na primeira vez, o Android pede permissão para o navegador <strong>instalar apps desconhecidos</strong>: toque em <em>Configurações</em>, ative a opção e volte.</li>
        <li>Toque em <strong>Instalar</strong>. O Play Protect pode avisar que o app não veio da Play Store; isso é esperado para apps distribuídos por fora da loja.</li>
      </ol>
      <p class="dica">Para atualizar, baixe a versão nova e instale por cima: os dados do app são mantidos, desde que a versão nova seja assinada com a mesma chave da anterior.</p>`;
  }
  const passosTela = `
      <div class="caixa">
        <p><strong>Android (Chrome):</strong> abra o app, toque no menu <strong>⋮</strong> e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p>
        <p><strong>iPhone (Safari):</strong> abra o app, toque em <strong>Compartilhar</strong> (quadrado com seta) e escolha <strong>Adicionar à Tela de Início</strong>.</p>
      </div>`;
  if (app.tipo === "pwa") {
    return `<p>Este app funciona no navegador e pode ser instalado como um app comum, com ícone próprio na tela inicial.</p>${passosTela}`;
  }
  return `<p>É um site: basta tocar em <strong>Abrir</strong>. Se quiser um atalho com ícone na tela inicial:</p>${passosTela}`;
}

function telaDetalhe(id) {
  const app = catalogo.apps.find((a) => a.id === id);
  if (!app) { conteudo().innerHTML = `<a class="voltar" href="#/">← Voltar</a><p class="vazio">App não encontrado.</p>`; return; }
  const v = ultima(app);
  const nomeCat = (catalogo.categorias && catalogo.categorias[app.categoria]) || app.categoria || "";
  const enderecoDetalhe = location.href;

  conteudo().innerHTML = `
    <a class="voltar" href="#/">← Todos os apps</a>
    <section class="cabeca">
      <img class="icone grande" src="${esc(app.icone)}" alt="" width="96" height="96">
      <div>
        <h1>${esc(app.nome)}</h1>
        <div class="cat">${esc(nomeCat)}</div>
        ${selos(app)}
      </div>
    </section>

    <div class="fatos">
      <div class="fato"><strong>${esc(v.versao || "—")}</strong><span>Versão</span></div>
      <div class="fato"><strong>${esc(dataBR(v.data))}</strong><span>Atualizado em</span></div>
      <div class="fato"><strong>${esc(TIPOS[app.tipo] || app.tipo)}</strong><span>Tipo</span></div>
      ${v.tamanho ? `<div class="fato"><strong>${esc(v.tamanho)}</strong><span>Tamanho</span></div>` : ""}
    </div>

    ${botoesAcao(app)}

    ${PLATAFORMA === "desktop" ? `
    <section class="bloco">
      <h2>Abrir no celular</h2>
      <div class="caixa qr">
        <div class="codigo" id="qr" aria-label="Código QR desta página"></div>
        <p>Aponte a câmera do celular para o código: ele abre esta mesma página no telefone, de onde você instala ou abre o app.</p>
      </div>
    </section>` : ""}

    ${v.notas && v.notas.length ? `
    <section class="bloco">
      <h2>Novidades da versão ${esc(v.versao)}</h2>
      <ul class="passos">${v.notas.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
    </section>` : ""}

    <section class="bloco">
      <h2>Sobre</h2>
      <p>${esc(app.descricao || app.resumo)}</p>
    </section>

    ${app.capturas && app.capturas.length ? `
    <section class="bloco">
      <h2>Telas</h2>
      <div class="capturas">${app.capturas.map((c) => `<img src="${esc(c)}" alt="Tela de ${esc(app.nome)}" loading="lazy">`).join("")}</div>
    </section>` : ""}

    <section class="bloco">
      <h2>Como instalar</h2>
      ${comoInstalar(app)}
    </section>

    ${(app.versoes || []).length > 1 ? `
    <section class="bloco">
      <h2>Histórico de versões</h2>
      <ul class="versoes caixa">${app.versoes.map((x) => `
        <li>
          <div class="linha"><strong>Versão ${esc(x.versao)}</strong><span>${esc(dataBR(x.data))}</span></div>
          ${x.notas && x.notas.length ? `<ul>${x.notas.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
          ${x.apk ? `<a class="botao contorno pequeno" style="margin-top:8px" href="${esc(x.apk)}" download>Baixar esta versão</a>` : ""}
          ${(x.outros || []).map((o) => `<a class="botao contorno pequeno" style="margin-top:8px" href="${esc(o.apk)}" download>${esc(o.nome)}</a>`).join(" ")}
        </li>`).join("")}
      </ul>
    </section>` : ""}`;

  const qr = $("#qr");
  if (qr) {
    if (window.QRCode) new QRCode(qr, { text: enderecoDetalhe, width: 140, height: 140 });
    else qr.closest(".bloco").hidden = true;
  }
  $("#compartilhar").addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ title: app.nome, text: app.resumo, url: enderecoDetalhe });
      else { await navigator.clipboard.writeText(enderecoDetalhe); avisar("Link copiado."); }
    } catch (_) { /* usuário cancelou */ }
  });
  document.title = `${app.nome} · ${catalogo.loja.nome || "Vitrine"}`;
  window.scrollTo(0, 0);
}

// ---------- Infra ----------
function avisar(msg) {
  const el = $("#aviso");
  el.textContent = msg; el.hidden = false;
  clearTimeout(avisar.t); avisar.t = setTimeout(() => (el.hidden = true), 2500);
}

function rotear() {
  const m = location.hash.match(/^#\/app\/(.+)$/);
  if (m) telaDetalhe(decodeURIComponent(m[1])); else telaInicio();
}

async function iniciar() {
  try {
    const r = await fetch("apps.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    catalogo = await r.json();
  } catch (e) {
    conteudo().innerHTML = `<p class="vazio">Não foi possível carregar o catálogo (apps.json).</p>`;
    return;
  }
  catalogo.loja = catalogo.loja || {};
  $("#nome-loja").textContent = catalogo.loja.nome || "Vitrine";
  $("#subtitulo-loja").textContent = catalogo.loja.subtitulo || "";
  window.addEventListener("hashchange", rotear);
  rotear();
}

// Botão "Instalar a Vitrine" (Chrome/Edge no Android e no computador).
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  pedidoInstalacao = e;
  $("#instalar-loja").hidden = false;
});
document.addEventListener("DOMContentLoaded", () => {
  $("#instalar-loja").addEventListener("click", async () => {
    if (!pedidoInstalacao) return;
    pedidoInstalacao.prompt();
    await pedidoInstalacao.userChoice;
    pedidoInstalacao = null;
    $("#instalar-loja").hidden = true;
  });
  iniciar();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
