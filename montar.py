#!/usr/bin/env python3
"""Monta o site da Vitrine numa pasta pronta para publicar (padrão: _site/).

- Copia a loja (index.html, app.js, estilo.css, apps.json, ícones...).
- Para cada app com o campo "pasta", copia essa pasta do repositório para apps/<id>/,
  assim sites e painéis guardados aqui ficam hospedados junto com a loja.

Uso:  python3 montar.py [_site]
"""
import json
import pathlib
import shutil
import sys

from publicar import validar

LOJA = pathlib.Path(__file__).resolve().parent
RAIZ = LOJA
IGNORAR = shutil.ignore_patterns("*.py", "__pycache__", "*.md", ".git", ".github", ".gitignore", "_site")


def main():
    destino = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "_site").resolve()
    cat = json.loads((LOJA / "apps.json").read_text(encoding="utf-8"))
    erros = validar(cat, RAIZ)
    if erros:
        for e in erros:
            print("ERRO:", e)
        sys.exit(1)

    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(LOJA, destino, ignore=IGNORAR)

    for app in cat["apps"]:
        if app.get("pasta"):
            alvo = destino / "apps" / app["id"]
            shutil.copytree(RAIZ / app["pasta"], alvo, ignore=shutil.ignore_patterns("*.py", "__pycache__"))
            print(f"hospedado: {app['pasta']} -> apps/{app['id']}/")

    (destino / ".nojekyll").write_text("")
    print(f"Site montado em {destino} com {len(cat['apps'])} app(s).")


if __name__ == "__main__":
    main()
