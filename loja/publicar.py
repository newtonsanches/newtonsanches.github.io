#!/usr/bin/env python3
"""Registra uma versão nova de um app no catálogo da Vitrine (loja/apps.json).

É o script que os compiladores (workflows de build) chamam ao gerar uma versão nova.
Só usa a biblioteca padrão do Python.

Exemplos
--------
Versão nova de um app que já está na loja:
    python3 loja/publicar.py --id meu-app --versao 1.3.0 \\
        --apk https://github.com/usuario/meu-app/releases/download/v1.3.0/meu-app.apk \\
        --tamanho "8,4 MB" --nota "Corrige o login" --nota "Tela de ajustes nova" \\
        --outro "Completa=https://github.com/usuario/meu-app/releases/download/v1.3.0/meu-app-completo.apk"

App novo (primeira publicação):
    python3 loja/publicar.py --id meu-app --versao 1.0.0 --novo \\
        --nome "Meu App" --tipo android --categoria utilidades \\
        --resumo "Uma frase sobre o app" --apk https://.../meu-app.apk

Só conferir se o catálogo está válido:
    python3 loja/publicar.py --validar
"""
import argparse
import datetime as dt
import json
import pathlib
import re
import sys

PASTA = pathlib.Path(__file__).resolve().parent
CATALOGO = PASTA / "apps.json"
TIPOS = {"web", "pwa", "android"}
STATUS = {"estavel", "beta", "encerrado", "pessoal"}
ID_VALIDO = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DATA_VALIDA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validar(cat, raiz=None):
    """Devolve a lista de problemas do catálogo (vazia = tudo certo)."""
    erros = []
    ids = set()
    for i, app in enumerate(cat.get("apps", [])):
        nome = app.get("id") or f"apps[{i}]"
        for campo in ("id", "nome", "resumo", "tipo", "icone"):
            if not app.get(campo):
                erros.append(f"{nome}: falta o campo '{campo}'")
        if app.get("id") and not ID_VALIDO.match(app["id"]):
            erros.append(f"{nome}: id deve ter só minúsculas, números e hífens")
        if app.get("id") in ids:
            erros.append(f"{nome}: id repetido")
        ids.add(app.get("id"))
        if app.get("tipo") and app["tipo"] not in TIPOS:
            erros.append(f"{nome}: tipo '{app['tipo']}' inválido (use {', '.join(sorted(TIPOS))})")
        if app.get("status") and app["status"] not in STATUS:
            erros.append(f"{nome}: status '{app['status']}' inválido (use {', '.join(sorted(STATUS))})")
        if app.get("categoria") and app["categoria"] not in cat.get("categorias", {}):
            erros.append(f"{nome}: categoria '{app['categoria']}' não existe em 'categorias'")
        versoes = app.get("versoes") or []
        if not versoes:
            erros.append(f"{nome}: precisa de pelo menos uma versão")
        vistas = set()
        for v in versoes:
            if not v.get("versao"):
                erros.append(f"{nome}: versão sem número")
            if v.get("versao") in vistas:
                erros.append(f"{nome}: versão {v.get('versao')} repetida")
            vistas.add(v.get("versao"))
            if not DATA_VALIDA.match(v.get("data", "")):
                erros.append(f"{nome} {v.get('versao')}: data deve ser AAAA-MM-DD")
        if app.get("tipo") == "android" and not any(v.get("apk") for v in versoes):
            erros.append(f"{nome}: app Android sem nenhum link de APK")
        if app.get("tipo") in ("web", "pwa") and not (app.get("pasta") or (app.get("acesso") or {}).get("web")):
            erros.append(f"{nome}: app web sem 'pasta' nem 'acesso.web'")
        if raiz is not None:
            icone = app.get("icone", "")
            if icone and not icone.startswith(("http://", "https://")) and not (PASTA / icone).exists():
                erros.append(f"{nome}: ícone não encontrado ({icone})")
            if app.get("pasta") and not (raiz / app["pasta"]).is_dir():
                erros.append(f"{nome}: pasta não encontrada ({app['pasta']})")
    return erros


def ler():
    return json.loads(CATALOGO.read_text(encoding="utf-8"))


def gravar(cat):
    CATALOGO.write_text(json.dumps(cat, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def principal():
    p = argparse.ArgumentParser(description="Publica uma versão nova na Vitrine.")
    p.add_argument("--validar", action="store_true", help="só confere o catálogo e sai")
    p.add_argument("--id", help="identificador do app (ex.: meu-app)")
    p.add_argument("--versao", help="número da versão (ex.: 1.3.0)")
    p.add_argument("--data", default=dt.date.today().isoformat(), help="AAAA-MM-DD (padrão: hoje)")
    p.add_argument("--nota", action="append", default=[], help="novidade da versão (pode repetir)")
    p.add_argument("--apk", help="link de download do APK desta versão")
    p.add_argument("--outro", action="append", default=[], help='outra edição do APK, ex.: "Completa=https://..." (pode repetir)')
    p.add_argument("--tamanho", help='tamanho do arquivo, ex.: "8,4 MB"')
    p.add_argument("--web", help="link para abrir o app no navegador")
    p.add_argument("--substituir", action="store_true", help="sobrescreve se a versão já existir")
    novo = p.add_argument_group("app novo (use com --novo)")
    novo.add_argument("--novo", action="store_true", help="cadastra o app se ainda não existir")
    novo.add_argument("--nome")
    novo.add_argument("--tipo", choices=sorted(TIPOS))
    novo.add_argument("--resumo")
    novo.add_argument("--descricao")
    novo.add_argument("--categoria")
    novo.add_argument("--icone", help="caminho relativo à pasta loja/ ou URL")
    novo.add_argument("--status", choices=sorted(STATUS))
    a = p.parse_args()

    cat = ler()
    raiz = PASTA.parent

    if a.validar:
        erros = validar(cat, raiz)
        for e in erros:
            print("ERRO:", e)
        print("Catálogo válido." if not erros else f"{len(erros)} problema(s).")
        return 1 if erros else 0

    if not a.id or not a.versao:
        p.error("informe --id e --versao (ou use --validar)")

    app = next((x for x in cat["apps"] if x["id"] == a.id), None)
    if app is None:
        if not a.novo:
            p.error(f"o app '{a.id}' não está no catálogo; para cadastrá-lo use --novo com --nome, --tipo e --resumo")
        if not (a.nome and a.tipo and a.resumo):
            p.error("app novo precisa de --nome, --tipo e --resumo")
        app = {
            "id": a.id, "nome": a.nome, "resumo": a.resumo,
            "descricao": a.descricao or a.resumo,
            "categoria": a.categoria or "utilidades",
            "tipo": a.tipo, "status": a.status or "estavel",
            "icone": a.icone or "icones/icone.svg",
            "versoes": [],
        }
        cat["apps"].append(app)
    else:
        for campo in ("nome", "resumo", "descricao", "categoria", "icone", "status"):
            if getattr(a, campo):
                app[campo] = getattr(a, campo)

    if a.web:
        app.setdefault("acesso", {})["web"] = a.web

    versao = {"versao": a.versao, "data": a.data, "notas": a.nota}
    if a.apk:
        versao["apk"] = a.apk
    if a.tamanho:
        versao["tamanho"] = a.tamanho
    outros = []
    for item in a.outro:
        nome, sep, url = item.partition("=")
        if not sep or not nome.strip() or not url.strip().startswith("http"):
            p.error(f'--outro deve ser "Nome=https://...", recebido: {item}')
        outros.append({"nome": nome.strip(), "apk": url.strip()})
    if outros:
        versao["outros"] = outros

    existentes = [v for v in app["versoes"] if v.get("versao") == a.versao]
    if existentes and not a.substituir:
        print(f"A versão {a.versao} de '{a.id}' já está publicada. Use --substituir para sobrescrever.")
        return 1
    app["versoes"] = [versao] + [v for v in app["versoes"] if v.get("versao") != a.versao]

    erros = validar(cat, raiz)
    if erros:
        for e in erros:
            print("ERRO:", e)
        print("Nada foi gravado.")
        return 1
    gravar(cat)
    print(f"Publicado: {app['nome']} {a.versao} ({a.data})")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
