#!/usr/bin/env python3
import subprocess
import json
import re

programs = ['diet', 'digestive', 'head', 'neuro', 'pain', 'pediatric', 'skin', 'wellness', 'women']

def run_query(sql):
    cmd = f'''export PATH=$PATH:/usr/local/bin && npx wrangler d1 execute brd-clinic-db --remote --command "{sql}" 2>/dev/null'''
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/Users/amu/dev/brd-clinic')
    return result.stdout

def extract_sections(output):
    try:
        # Find the JSON part
        match = re.search(r'\{[\s\S]*\}', output)
        if match:
            data = json.loads(match.group())
            if data.get('results') and len(data['results']) > 0:
                sections_str = data['results'][0].get('sections', '[]')
                return json.loads(sections_str)
    except:
        pass
    return []

print("=" * 80)
print("프로그램 섹션 비교 감사 (한국어 vs 일본어)")
print("=" * 80)

all_issues = []

for prog in programs:
    print(f"\n{'─' * 60}")
    print(f"프로그램: {prog.upper()}")
    print(f"{'─' * 60}")
    
    # Get Korean sections
    ko_output = run_query(f"SELECT sections FROM programs WHERE id = '{prog}'")
    ko_sections = extract_sections(ko_output)
    
    # Get Japanese sections
    ja_output = run_query(f"SELECT sections FROM program_translations WHERE program_id = '{prog}' AND locale = 'ja'")
    ja_sections = extract_sections(ja_output)
    
    print(f"\n한국어 섹션 ({len(ko_sections)}개):")
    for i, s in enumerate(ko_sections):
        stype = s.get('type', 'Unknown')
        title = (s.get('title') or '').replace('<br/>', ' ').replace('\n', ' ')[:30]
        img = s.get('image', '')
        img_name = img.split('/')[-1] if img else '(no image)'
        print(f"  {i+1}. [{stype}] {title}... 📷{img_name}")
    
    print(f"\n일본어 섹션 ({len(ja_sections)}개):")
    for i, s in enumerate(ja_sections):
        stype = s.get('type', 'Unknown')
        title = (s.get('title') or '').replace('<br/>', ' ').replace('\n', ' ')[:30]
        img = s.get('image', '')
        img_name = img.split('/')[-1] if img else '(no image)'
        print(f"  {i+1}. [{stype}] {title}... 📷{img_name}")
    
    # Compare
    issues = []
    
    if len(ko_sections) != len(ja_sections):
        issues.append(f"⚠️ 섹션 개수 불일치: 한국어 {len(ko_sections)}개 vs 일본어 {len(ja_sections)}개")
    
    max_len = max(len(ko_sections), len(ja_sections))
    for i in range(max_len):
        ko = ko_sections[i] if i < len(ko_sections) else None
        ja = ja_sections[i] if i < len(ja_sections) else None
        
        if ko and not ja:
            issues.append(f"❌ {i+1}번 [{ko.get('type')}]: 일본어에서 누락됨")
        elif ja and not ko:
            issues.append(f"⚠️ {i+1}번 [{ja.get('type')}]: 한국어에 없는 추가 섹션")
        elif ko and ja:
            if ko.get('type') != ja.get('type'):
                issues.append(f"❌ {i+1}번: 타입 불일치 - 한국어 [{ko.get('type')}] vs 일본어 [{ja.get('type')}]")
            if ko.get('image') != ja.get('image'):
                issues.append(f"⚠️ {i+1}번 [{ko.get('type')}]: 이미지 경로 불일치")
                issues.append(f"    한국어: {ko.get('image', '없음')}")
                issues.append(f"    일본어: {ja.get('image', '없음')}")
    
    print("\n🔍 비교 결과:")
    if issues:
        for issue in issues:
            print(f"  {issue}")
        all_issues.append((prog, issues))
    else:
        print("  ✅ 모든 섹션 일치")

print("\n" + "=" * 80)
print("요약")
print("=" * 80)

if all_issues:
    print(f"\n문제가 있는 프로그램: {len(all_issues)}개")
    for prog, issues in all_issues:
        print(f"\n  📛 {prog}:")
        for issue in issues:
            print(f"    {issue}")
else:
    print("\n✅ 모든 프로그램의 일본어 섹션이 한국어와 일치합니다.")
