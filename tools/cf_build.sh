#!/bin/sh
# Cloudflare Pages build: copy the site into dist/, leaving out working files (like .vercelignore did).
set -e
rm -rf dist && mkdir dist
for f in *; do
  case "$f" in dist|_src|_raw|tools|supabase|README.md) ;; *) cp -r "$f" dist/ ;; esac
done
echo "built dist/ with: $(ls dist | tr '\n' ' ')"
