#!/bin/bash

# Source directory
SRC="public/images/programs/digestive"

# Target programs
PROGRAMS=("head" "neuro" "pain" "pediatric" "skin" "wellness" "women")

# Files to copy (Source -> Target Name)
# Using hero_wthn.png as the placeholder for hero.png
cp "$SRC/hero_wthn.png" "$SRC/hero.png" 2>/dev/null || true

for prog in "${PROGRAMS[@]}"; do
    DEST="public/images/programs/$prog"
    mkdir -p "$DEST"
    
    echo "Setting up $prog..."
    
    # Copy and rename to standard names
    cp "$SRC/hero_wthn.png" "$DEST/hero.png"
    cp "$SRC/mechanism_diag.png" "$DEST/mechanism.png"
    cp "$SRC/solution_tea.png" "$DEST/solution.png"
    cp "$SRC/process_diagram.png" "$DEST/process.png"
done

echo "Image structure setup complete."
