#!/usr/bin/env python3
import subprocess
import json
import re

programs = ['diet', 'digestive', 'head', 'neuro', 'pain', 'pediatric', 'skin', 'wellness', 'women']
locales = ['ja', 'en', 'zh-hans']

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
        # Try alternative parsing
        match = re.search(r'"sections":\s*"(\[[\s\S]*?\])"', output)
        if match:
            sections_str = match.group(1).replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
            return json.loads(sections_str)
    except Exception as e:
        pass
    return []

def get_section_types(sections):
    return [s.get('type', 'Unknown') for s in sections]

def get_section_summary(sections):
    result = []
    for i, s in enumerate(sections):
        stype = s.get('type', 'Unknown')
        has_img = '📷' if s.get('image') else '  '
        result.append(f"{i+1}.{has_img}[{stype}]")
    return result

print("=" * 100)
print("전체 번역 감사 리포트 (한국어 기준)")
print("=" * 100)

summary = {}

for prog in programs:
    print(f"\n{'━' * 100}")
    print(f"프로그램: {prog.upper()}")
    print(f"{'━' * 100}")
    
    # Get Korean sections (source of truth)
    ko_output = run_query(f"SELECT sections FROM programs WHERE id = '{prog}'")
    ko_sections = extract_sections(ko_output)
    ko_types = get_section_types(ko_sections)
    
    print(f"\n🇰🇷 한국어 (원본) - {len(ko_sections)}개 섹션:")
    for item in get_section_summary(ko_sections):
        print(f"  {item}")
    
    prog_issues = {}
    
    for locale in locales:
        locale_output = run_query(f"SELECT sections FROM program_translations WHERE program_id = '{prog}' AND locale = '{locale}'")
        locale_sections = extract_sections(locale_output)
        locale_types = get_section_types(locale_sections)
        
        flag = {'ja': '🇯🇵', 'en': '🇺🇸', 'zh-hans': '🇨🇳'}[locale]
        name = {'ja': '일본어', 'en': '영어', 'zh-hans': '중국어'}[locale]
        
        print(f"\n{flag} {name} - {len(locale_sections)}개 섹션:")
        for item in get_section_summary(locale_sections):
            print(f"  {item}")
        
        # Compare
        issues = []
        
        # Count mismatch
        if len(ko_sections) != len(locale_sections):
            issues.append(f"섹션 개수: {len(ko_sections)} → {len(locale_sections)} ({len(locale_sections) - len(ko_sections):+d})")
        
        # Type order mismatch
        max_len = max(len(ko_types), len(locale_types))
        type_mismatches = []
        missing = []
        extra = []
        
        for i in range(max_len):
            ko_type = ko_types[i] if i < len(ko_types) else None
            loc_type = locale_types[i] if i < len(locale_types) else None
            
            if ko_type and not loc_type:
                missing.append(f"{i+1}.[{ko_type}]")
            elif loc_type and not ko_type:
                extra.append(f"{i+1}.[{loc_type}]")
            elif ko_type and loc_type and ko_type.lower() != loc_type.lower():
                type_mismatches.append(f"{i+1}.[{ko_type}→{loc_type}]")
        
        if missing:
            issues.append(f"누락: {', '.join(missing)}")
        if extra:
            issues.append(f"추가: {', '.join(extra)}")
        if type_mismatches:
            issues.append(f"순서/타입: {', '.join(type_mismatches)}")
            
        # Check images
        img_issues = []
        for i in range(min(len(ko_sections), len(locale_sections))):
            ko_img = ko_sections[i].get('image', '')
            loc_img = locale_sections[i].get('image', '')
            if ko_img != loc_img:
                img_issues.append(f"{i+1}번")
        if img_issues:
            issues.append(f"이미지 불일치: {', '.join(img_issues)}")
        
        prog_issues[locale] = issues
        
        if issues:
            print(f"  ⚠️ 문제: {'; '.join(issues)}")
        else:
            print(f"  ✅ 완전 일치")
    
    summary[prog] = prog_issues

# Summary table
print("\n" + "=" * 100)
print("요약 테이블")
print("=" * 100)
print(f"\n{'프로그램':<12} {'🇯🇵 일본어':<30} {'🇺🇸 영어':<30} {'🇨🇳 중국어':<30}")
print("-" * 100)

for prog in programs:
    ja_status = "✅" if not summary[prog].get('ja') else f"❌ {len(summary[prog]['ja'])}건"
    en_status = "✅" if not summary[prog].get('en') else f"❌ {len(summary[prog]['en'])}건"
    zh_status = "✅" if not summary[prog].get('zh-hans') else f"❌ {len(summary[prog]['zh-hans'])}건"
    print(f"{prog:<12} {ja_status:<30} {en_status:<30} {zh_status:<30}")

# Priority list
print("\n" + "=" * 100)
print("수정 우선순위 (문제 심각도순)")
print("=" * 100)

priority = []
for prog in programs:
    total_issues = sum(len(v) for v in summary[prog].values())
    if total_issues > 0:
        priority.append((prog, total_issues, summary[prog]))

priority.sort(key=lambda x: -x[1])

for i, (prog, count, issues) in enumerate(priority):
    print(f"\n{i+1}. {prog.upper()} ({count}건)")
    for locale, locale_issues in issues.items():
        if locale_issues:
            flag = {'ja': '🇯🇵', 'en': '🇺🇸', 'zh-hans': '🇨🇳'}[locale]
            print(f"   {flag}: {'; '.join(locale_issues)}")
