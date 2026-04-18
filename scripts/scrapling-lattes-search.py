#!/usr/bin/env python3
"""
Scrapling-powered Lattes ID lookup.

Uses Scrapling's Fetcher (curl_cffi, TLS fingerprint impersonation) to search
for a researcher's CNPq Lattes 16-digit ID without spawning a full browser.

TLS impersonation makes our HTTP requests look like real Chrome at the TLS/JA3
level — more durable than Playwright's JS-patched stealth because bot detectors
cannot distinguish us from a genuine browser at the network layer.

Strategy (in order):
  1. DuckDuckGo HTML with site:lattes.cnpq.br  (returns direct CV URLs)
  2. DuckDuckGo HTML without site: restriction  (wider net)
  3. Bing with site:lattes.cnpq.br
  4. Startpage (Google proxy) — server-rendered Google results, no JS needed
  Returns null if all fail.

Usage:
    python scrapling-lattes-search.py "Nome Completo" [--institution "UFMS"] [--state "MS"]

Output JSON to stdout:
    {"lattesId": "1234567890123456", "source": "duckduckgo"}
    {"lattesId": null, "source": null}
"""

import sys
import re
import json
import time
import argparse
import urllib.parse
import urllib.request
import logging

logging.disable(logging.WARNING)

try:
    from scrapling.fetchers import Fetcher
    SCRAPLING_OK = True
except ImportError:
    SCRAPLING_OK = False

LATTES_ID_RE = re.compile(r'lattes\.cnpq\.br[/=](\d{16})')
BUSCATEXTUAL_RE = re.compile(r'buscatextual\.cnpq\.br[^"\'<>\s]*?[?&]id=(\d{16})')

CHROME_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
}


def extract_lattes_id(body: str) -> str | None:
    """Extract a Lattes 16-digit ID from HTML body (handles uddg= encoded links)."""
    # Decode all DuckDuckGo/Bing redirect params that embed the real URL
    for m in re.finditer(r"(?:uddg|url|u)=([^&\"'\s]{16,})", body):
        try:
            decoded = urllib.parse.unquote(m.group(1))
            hit = LATTES_ID_RE.search(decoded) or BUSCATEXTUAL_RE.search(decoded)
            if hit:
                return hit.group(1)
        except Exception:
            pass
    # Direct patterns in the body
    hit = LATTES_ID_RE.search(body) or BUSCATEXTUAL_RE.search(body)
    return hit.group(1) if hit else None


def fetch_scrapling(url: str, retries: int = 2) -> tuple[int, str] | None:
    """Fetch URL with TLS impersonation. Returns (status, body) or None."""
    for attempt in range(retries):
        try:
            page = Fetcher.get(
                url,
                stealthy_headers=True,
                impersonate="chrome124",
                timeout=20,
                follow_redirects=True,
            )
            return page.status, page.body.decode("utf-8", errors="ignore")
        except Exception:
            if attempt < retries - 1:
                time.sleep(2)
    return None


def search_duckduckgo(query: str) -> str | None:
    """Search DuckDuckGo HTML endpoint."""
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    result = fetch_scrapling(url)
    if result is None:
        return None
    status, body = result
    if status == 202:  # Rate-limited — DuckDuckGo challenge page
        return None
    return extract_lattes_id(body)


def search_bing(query: str) -> str | None:
    """Search Bing as fallback."""
    url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}&cc=BR&setlang=pt-BR"
    result = fetch_scrapling(url)
    if result is None:
        return None
    _, body = result
    return extract_lattes_id(body)


def _fetch_urllib(url: str) -> str | None:
    """Fetch URL via urllib (no TLS impersonation, handles gzip)."""
    headers = {k: v for k, v in CHROME_HEADERS.items() if k != "Accept-Encoding"}
    try:
        req = urllib.request.Request(url, headers=headers)
        resp = urllib.request.urlopen(req, timeout=20)
        raw = resp.read()
        encoding = resp.headers.get("Content-Encoding", "")
        if "gzip" in encoding:
            import gzip
            raw = gzip.decompress(raw)
        return raw.decode("utf-8", errors="ignore")
    except Exception:
        return None


def search_startpage(query: str) -> str | None:
    """Search Startpage (Google proxy) — returns server-rendered Google results."""
    url = f"https://www.startpage.com/do/search?q={urllib.parse.quote(query)}"
    body = _fetch_urllib(url)
    if body is None:
        return None
    return extract_lattes_id(body)


def search_brave(query: str) -> str | None:
    """Search Brave — server-rendered results, good Lattes indexing."""
    url = f"https://search.brave.com/search?q={urllib.parse.quote(query)}"
    body = _fetch_urllib(url)
    if body is None:
        return None
    return extract_lattes_id(body)


def find_lattes_id(name: str, institution: str | None, state: str | None) -> dict:
    """
    Try multiple query strategies across search engines.
    Returns {"lattesId": str|None, "source": str|None, ...}.
    """
    ctx = f" {institution}" if institution else (f" {state}" if state else "")

    strategies = [
        # (engine_fn, query, label)
        (search_duckduckgo, f'"{name}"{ctx} site:lattes.cnpq.br', "ddg+site"),
        (search_duckduckgo, f'"{name}"{ctx} lattes cnpq', "ddg"),
        (search_bing, f'"{name}"{ctx} site:lattes.cnpq.br', "bing+site"),
        (search_bing, f'"{name}"{ctx} lattes cnpq', "bing"),
        (search_brave, f'"{name}"{ctx} lattes cnpq', "brave"),
        (search_startpage, f'{name} lattes cnpq', "startpage"),
        (search_startpage, f'"{name}" lattes cnpq curriculo', "startpage+cv"),
    ]

    for engine_fn, query, label in strategies:
        try:
            lattes_id = engine_fn(query)
            if lattes_id:
                return {"lattesId": lattes_id, "source": label, "query": query}
            # Small delay between strategies to avoid rate limits
            time.sleep(1.5)
        except Exception:
            continue

    return {"lattesId": None, "source": None}


def main():
    if not SCRAPLING_OK:
        print(json.dumps({"lattesId": None, "source": None, "error": "scrapling not installed"}))
        sys.exit(0)

    parser = argparse.ArgumentParser()
    parser.add_argument("name", help="Full name of the researcher")
    parser.add_argument("--institution", default=None)
    parser.add_argument("--state", default=None)
    args = parser.parse_args()

    try:
        result = find_lattes_id(args.name, args.institution, args.state)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"lattesId": None, "source": None, "error": str(e)}))


if __name__ == "__main__":
    main()
