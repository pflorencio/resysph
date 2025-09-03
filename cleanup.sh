set -euo pipefail

git_checkout_or_switch() {
  local branch="$1"
  if git rev-parse --verify "$branch" >/dev/null 2>&1; then
    git checkout "$branch"
  else
    git checkout -b "$branch"
  fi
}

tracked() { git ls-files --error-unmatch "$1" >/dev/null 2>&1; }
rm_safe() { if tracked "$1"; then git rm -f "$1"; else rm -f "$1"; fi; }
mv_safe() { if tracked "$1"; then git mv "$1" "$2"; else mkdir -p "$(dirname "$2")"; mv "$1" "$2"; fi; }

echo "Creating/using safety branch..."
git_checkout_or_switch "chore/structure-cleanup"

echo "Ensuring frontend/public exists..."
mkdir -p frontend/public

echo "---- FRONTEND: move stray root files into ./frontend (or drop duplicates) ----"

# next-env.d.ts
if [[ -f "next-env.d.ts" ]]; then
  if [[ -f "frontend/next-env.d.ts" ]]; then
    echo "Frontend already has next-env.d.ts. Removing root copy (tracked or not)."
    rm_safe "next-env.d.ts"
  else
    echo "Moving next-env.d.ts to frontend/"
    mv_safe "next-env.d.ts" "frontend/next-env.d.ts"
  fi
fi

# public/
if [[ -d "public" ]]; then
  echo "Syncing root /public into frontend/public (without overwriting existing)..."
  rsync -a --ignore-existing public/ frontend/public/
  echo "Removing root /public (tracked or not)."
  if tracked "public"; then git rm -r public; else rm -rf public; fi
fi

# postcss.config.mjs
if [[ -f "postcss.config.mjs" ]]; then
  if [[ -f "frontend/postcss.config.js" || -f "frontend/postcss.config.mjs" ]]; then
    echo "Frontend already has PostCSS config. Removing root postcss.config.mjs."
    rm_safe "postcss.config.mjs"
  else
    echo "Moving postcss.config.mjs to frontend/"
    mv_safe "postcss.config.mjs" "frontend/postcss.config.mjs"
  fi
fi

# tsconfig.json
if [[ -f "tsconfig.json" ]]; then
  if [[ -f "frontend/tsconfig.json" ]]; then
    echo "Frontend already has tsconfig.json. Removing root tsconfig.json."
    rm_safe "tsconfig.json"
  else
    echo "Moving tsconfig.json to frontend/"
    mv_safe "tsconfig.json" "frontend/tsconfig.json"
  fi
fi

echo "---- BACKEND: remove Node/TS artifacts and keep Prisma Python layout ----"
# backend/tsconfig.json
if [[ -f "backend/tsconfig.json" ]]; then
  echo "Removing backend/tsconfig.json"
  rm_safe "backend/tsconfig.json"
fi
# backend/package.json & lock
if [[ -f "backend/package.json" ]]; then
  echo "Removing backend/package.json"
  rm_safe "backend/package.json"
fi
if [[ -f "backend/package-lock.json" ]]; then
  echo "Removing backend/package-lock.json"
  rm_safe "backend/package-lock.json"
fi

echo "---- BACKEND: ensure .gitignore keeps prisma_client but avoids noisy binaries ----"
BACKEND_GITIGNORE="backend/.gitignore"
touch "$BACKEND_GITIGNORE"

ensure_rule() {
  local rule="$1"
  grep -qxF "$rule" "$BACKEND_GITIGNORE" || echo "$rule" >> "$BACKEND_GITIGNORE"
}
ensure_rule "__pycache__/"
ensure_rule "*.pyc"
ensure_rule "prisma_client/binaries/"
ensure_rule "prisma_client/engine/"

git add -A
git commit -m "chore(structure): clean root/FE/BE layout; keep prisma_client checked in; remove Node/TS from backend; move stray FE files"

echo "---- FINAL TREE (3 levels) ----"
tree -L 3 -a -I "node_modules|.next|.git|.DS_Store|venv|__pycache__"

echo "Done ✅"
