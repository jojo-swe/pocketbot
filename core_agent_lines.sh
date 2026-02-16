#!/bin/bash
# Count core agent lines (excluding channels/, cli/, providers/ adapters)
cd "$(dirname "$0")" || exit 1

echo "nanobot core agent line count"
echo "================================"
echo ""

for dir in agent agent/tools bus config cron heartbeat session utils web; do
  count=$(find "nanobot/$dir" -maxdepth 1 -name "*.py" -exec cat {} + 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    printf "  %-16s %5s lines\n" "$dir/" "$count"
  fi
done

root=$(cat nanobot/__init__.py nanobot/__main__.py 2>/dev/null | wc -l)
printf "  %-16s %5s lines\n" "(root)" "$root"

echo ""
total=$(find nanobot -name "*.py" ! -path "*/channels/*" ! -path "*/cli/*" ! -path "*/providers/*" | xargs cat 2>/dev/null | wc -l)
echo "  Core total:     $total lines"
echo ""
echo "  (excludes: channels/, cli/, providers/)"
