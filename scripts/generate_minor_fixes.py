#!/usr/bin/env python3
import subprocess
import json
import re

programs_to_fix = ['digestive', 'pediatric', 'skin', 'pain', 'women']

def run_query(sql):
    cmd = f'''export PATH=$PATH:/usr/local/bin && npx wrangler d1 execute brd-clinic-db --remote --command "{sql}" 2>/dev/null'''
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/Users/amu/dev/brd-clinic')
    return result.stdout

def extract_sections(output):
    try:
        match = re.search(r'\[\s*\{[\s\S]*\}\s*\]', output)
        if match:
             # Clean up the JSON
            json_str = match.group()
            data = json.loads(json_str)
            if data and len(data) > 0 and 'results' in data[0]:
                sections_str = data[0]['results'][0].get('sections', '[]')
                return json.loads(sections_str)
        match = re.search(r'"sections":\s*"(\[[\s\S]*?\])"', output)
        if match:
            # Handle escaped quotes and newlines if it comes as a string in the result
            sections_str = match.group(1).replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
            return json.loads(sections_str)
    except Exception as e:
        pass
    return []

print("-- Migration to fix minor issues in remaining Japanese programs")
print("-- Fixes: DoctorIntro casing, image paths")

for prog in programs_to_fix:
    # Get current Japanese sections
    ja_output = run_query(f"SELECT sections FROM program_translations WHERE program_id = '{prog}' AND locale = 'ja'")
    sections = extract_sections(ja_output)
    
    if not sections:
        print(f"-- Skipped {prog}: Could not fetch sections")
        continue

    # Fixes
    modified = False
    new_sections = []
    
    for section in sections:
        # Fix Type Casing
        if section.get('type') == 'doctor-intro':
            section['type'] = 'DoctorIntro'
            modified = True
            
        # Fix Image Paths
        # Pediatric Mechanism: mechanism.png -> mechanism_generated_v2.png
        if prog == 'pediatric' and section.get('type') == 'Mechanism':
            if section.get('image') == '/images/programs/pediatric/mechanism.png':
                section['image'] = '/images/programs/pediatric/mechanism_generated_v2.png'
                modified = True
                
        # Skin Mechanism: mechanism.png -> mechanism_generated_v2.png
        if prog == 'skin' and section.get('type') == 'Mechanism':
            if section.get('image') == '/images/programs/skin/mechanism.png':
                section['image'] = '/images/programs/skin/mechanism_generated_v2.png'
                modified = True

        # Skin Process: process.png -> process_diagram.png (Korean uses process_diagram.png)
        if prog == 'skin' and section.get('type') == 'Process':
             if section.get('image') == '/images/programs/skin/process.png':
                section['image'] = '/images/programs/skin/process_diagram.png'
                modified = True
        
        new_sections.append(section)
    
    if modified:
        json_str = json.dumps(new_sections, ensure_ascii=False)
        # Escape single quotes for SQL
        json_str = json_str.replace("'", "''")
        
        print(f"\n-- Fixing {prog}")
        print(f"UPDATE program_translations")
        print(f"SET sections = '{json_str}',")
        print(f"    updated_at = unixepoch()")
        print(f"WHERE program_id = '{prog}' AND locale = 'ja';")
    else:
        print(f"-- No changes needed for {prog}")
