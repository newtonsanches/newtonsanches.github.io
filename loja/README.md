# Vitrine

Uma página no estilo Play Store com todos os meus apps, sites e painéis.
No celular, cada app tem o botão certo: **Baixar APK** (Android), **Abrir** (sites) ou instruções para pôr o ícone na tela inicial.
No computador, cada app mostra um **QR code**: aponte a câmera do celular e a mesma página abre no telefone.
A própria Vitrine pode ser instalada no celular como um app.

## Como funciona (em 1 minuto)

```
build do app ──► cria o APK (ou publica o site)
      │
      └─► avisa a Vitrine: "app X, versão 1.3.0, APK neste link"
                │
                ▼
     workflow "Vitrine - publicar" (repositório newtonsanches.github.io)
       1. publicar.py grava a versão em loja/apps.json
       2. montar.py monta o site
       3. publica no GitHub Pages ──► página atualizada
```

Tudo o que a página mostra vem de um único arquivo: **`apps.json`**. Ninguém precisa mexer no HTML.

| Arquivo | Para que serve |
|---|---|
| `apps.json` | O catálogo: lista de apps, versões, links |
| `index.html`, `app.js`, `estilo.css` | A página em si |
| `manifest.webmanifest`, `sw.js`, `icones/` | Permitem instalar a Vitrine no celular e abri-la offline |
| `publicar.py` | Registra uma versão nova no catálogo (é o que os compiladores chamam) |
| `montar.py` | Monta o site final em `_site/` |
| `../.github/workflows/vitrine.yml` | Automação: grava a versão, monta e publica |

## Onde está no ar

**https://newtonsanches.github.io**, publicado pelo GitHub Pages a partir deste repositório (que é público).
Cada push no `main` republica o site sozinho.

## Os três tipos de app

| `tipo` | O que é | Botão principal | Onde fica o arquivo |
|---|---|---|---|
| `android` | App Android em APK | Baixar APK | Nas *Releases* do repositório do app (link em cada versão) |
| `pwa` | App web instalável (tem manifest) | Abrir + passo a passo para instalar | Onde o site estiver publicado (`acesso.web`) |
| `web` | Site ou painel comum | Abrir | `acesso.web`, ou uma pasta deste repositório (`pasta`), que a Vitrine hospeda em `apps/<id>/` |

## Publicar uma versão nova

### A. À mão, no computador

```bash
python3 loja/publicar.py --id meu-app --versao 1.3.0 \
  --apk https://github.com/newtonsanches/meu-app/releases/download/v1.3.0/meu-app.apk \
  --tamanho "8,4 MB" --nota "Corrige o login" --nota "Tela de ajustes nova"
git add loja/apps.json && git commit -m "Vitrine: meu-app 1.3.0" && git push   # no main
```

App que ainda não está na loja: acrescente `--novo --nome "Meu App" --tipo android --resumo "Uma frase" --categoria utilidades`.
O script recusa erros comuns (versão repetida, APK faltando, categoria inexistente) e, nesses casos, não grava nada.
Para só conferir o catálogo: `python3 loja/publicar.py --validar`.

### B. Pelo site do GitHub

**Actions → Vitrine - publicar → Run workflow**, preencha `id`, `versao`, `apk` e `notas` (separe as novidades com `|`).

### C. Automático, a partir do build de outro repositório (o caso principal)

1. Crie um token *fine-grained* em **GitHub → Settings → Developer settings → Personal access tokens**,
   com acesso só ao repositório `newtonsanches.github.io` e permissão **Contents: Read and write**.
2. No repositório do app, salve esse token como segredo `VITRINE_TOKEN` (**Settings → Secrets and variables → Actions**).
3. No fim do workflow de build, depois de criar a Release com o APK, acrescente:

```yaml
      - name: Avisar a Vitrine
        env:
          GH_TOKEN: ${{ secrets.VITRINE_TOKEN }}
          VERSAO: ${{ github.ref_name }}          # ex.: v1.3.0 quando o build roda numa tag
          APK: https://github.com/${{ github.repository }}/releases/download/${{ github.ref_name }}/meu-app.apk
        run: |
          payload=$(jq -n --arg v "${VERSAO#v}" --arg apk "$APK" \
            '{event_type: "nova-versao", client_payload: {id: "meu-app", versao: $v, apk: $apk, notas: "Novidade 1 | Novidade 2"}}')
          curl -fsS -X POST \
            -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
            https://api.github.com/repos/newtonsanches/newtonsanches.github.io/dispatches -d "$payload"
```

Campos aceitos em `client_payload`: `id`, `versao`, `notas` (separadas por `|`), `apk`, `outros` (outras edições: `Nome=link|Nome2=link`), `tamanho`, `web` e, só para app novo, `novo: {nome, tipo, resumo, categoria}`.

## Formato do `apps.json`

```json
{
  "id": "meu-app",                         // minúsculas e hífens; vira o endereço #/app/meu-app
  "nome": "Meu App",
  "resumo": "Uma frase que aparece no cartão",
  "descricao": "Texto mais longo da seção Sobre",
  "categoria": "utilidades",               // uma das chaves de "categorias"
  "tipo": "android",                       // android | pwa | web
  "status": "beta",                        // estavel | beta | encerrado | pessoal (opcional)
  "icone": "icones/apps/meu-app.svg",      // caminho dentro de loja/ ou URL
  "acesso": { "web": "https://..." },      // opcional
  "pasta": "meu-site",                     // opcional: pasta deste repositório para hospedar
  "codigo": "https://github.com/...",      // opcional: botão Código-fonte
  "capturas": ["icones/apps/tela1.png"],   // opcional
  "versoes": [                             // a mais nova primeiro (o publicar.py já faz isso)
    { "versao": "1.3.0", "data": "2026-11-25", "notas": ["..."], "apk": "https://...", "tamanho": "8,4 MB",
      "outros": [{ "nome": "Completa", "apk": "https://..." }] }   // outros: opcional, outras edições
  ]
}
```

Um app ganha o selo **Atualizado** durante 14 dias após a última versão.

## Ver no computador antes de publicar

```bash
python3 loja/montar.py _site && python3 -m http.server -d _site 8000
# abra http://localhost:8000
```

## Limites conhecidos

- **APK não instala no iPhone.** Para iPhone, a saída é a versão web/PWA do app. A página avisa isso quando aberta num iPhone.
- **Painéis do claude.ai** (como o de Cartões Corporativos) só abrem para quem está logado na conta dona ou recebeu o compartilhamento.
- **APK em repositório privado** (como o Faxina, no `rascunhos`): o link só baixa para quem está logado no GitHub com acesso ao repositório.
  Para qualquer pessoa baixar, o APK precisa estar num lugar público (por exemplo, as Releases deste repositório).
- **Campo `pasta`**: só funciona para pastas deste repositório.
- O QR code usa a biblioteca `qrcodejs` do cdnjs; se ela não carregar, a seção do QR simplesmente não aparece.
