---
description: 마이그레이션 패턴 사전
category: dev
---

# 마이그레이션 패턴 사전

> 자주 발생하는 마이그레이션 시나리오별 해결책

---

## 시나리오 1: 로컬 컴포넌트를 _local로 마이그레이션

### 상황
사용자가 `src/components/ui/Button.tsx`를 직접 수정함

### 해결책
```bash
# 에이전트가 자동 실행

# 1. 원본 백업
cp src/components/ui/Button.tsx .backups/migration/Button.tsx.original

# 2. _local로 이동
mkdir -p src/components/_local/ui
cp src/components/ui/Button.tsx src/components/_local/ui/Button.tsx

# 3. import 경로 자동 수정
grep -r "from.*ui/Button" src/ --include="*.tsx" --include="*.ts" | \
  sed 's|@/components/ui/Button|@/components/_local/ui/Button|g'

# 4. 새 버전의 Button.tsx 적용 (업스트림)
git checkout upstream/main -- src/components/ui/Button.tsx
```

### 결과
- 커스텀 버튼: `src/components/_local/ui/Button.tsx` (유지)
- 새 버전 버튼: `src/components/ui/Button.tsx` (업데이트됨)
- import 경로: 자동 수정됨

---

## 시나리오 2: wrangler.toml 설정 병합

### 상황
- 로컬: `ALIGO_API_KEY`, `CUSTOM_DOMAIN` 추가
- 업스트림: 새로운 `[vars]` 섹션 구조 변경

### 해결책
```javascript
// three-way-merge 전략
const base = parseToml('wrangler.toml.base');
const local = parseToml('wrangler.toml.local');
const upstream = parseToml('wrangler.toml.upstream');

const merged = {
  name: local.name || upstream.name,
  compatibility_date: upstream.compatibility_date,
  vars: {
    // 사용자 설정 유지
    ALIGO_API_KEY: local.vars.ALIGO_API_KEY,
    CUSTOM_DOMAIN: local.vars.CUSTOM_DOMAIN,
    // 새 설정 추가
    NEW_FEATURE_FLAG: upstream.vars.NEW_FEATURE_FLAG
  },
  d1_databases: upstream.d1_databases
};
```

---

## 시나리오 3: DB 커스텀 테이블 마이그레이션

### 상황
사용자가 `custom_patient_extra` 테이블 생성
새 버전에서 `patients` 테이블 스키마 변경

### 해결책
```sql
-- 1. 커스텀 테이블 백업
CREATE TABLE custom_patient_extra_backup AS 
SELECT * FROM custom_patient_extra;

-- 2. 새 마이그레이션 적용
-- 0150_add_patient_indexes.sql 실행

-- 3. 호환성 확인
SELECT CASE 
  WHEN EXISTS (
    SELECT 1 FROM pragma_table_info('patients') 
    WHERE name = 'new_column'
  ) THEN 'compatible'
  ELSE 'incompatible'
END as compatibility;
```

---

## 시나리오 4: 플러그인 호환성 확인

### 상황
사용자가 설치한 플러그인이 새 코어 버전과 호환되는지 확인

### 해결책
```javascript
const pluginCompatibility = {
  manifest: readPluginManifest('src/plugins/local/my-plugin/manifest.json'),
  coreVersion: readCoreVersion(),
  
  check: () => {
    const minCore = manifest.minCoreVersion;
    const maxCore = manifest.maxCoreVersion;
    const current = coreVersion;
    return semver.satisfies(current, `${minCore} - ${maxCore}`);
  }
};
```

---

## 시나리오 5: Git 없는 환경에서 업데이트

### 상황
스타터킷 ZIP으로 다운로드한 경우, Git 히스토리 없음

### 해결책
```bash
# 1. 파일 시스템 diff 생성
diff -r .backups/pre-update/ . --exclude=node_modules > changes.patch

# 2. 업데이트 적용
# (새 파일 덮어쓰기)

# 3. 변경사항 재적용
patch -p1 < changes.patch
```

---

## 시나리오 6: 충돌 해결 우선순위

### 기본 규칙
```javascript
const mergePriority = {
  // 로컬 우선 (사용자 커스텀)
  localPriority: [
    'wrangler.toml[vars]',
    '.env',
    'src/config.ts',
    'src/styles/global.css'
  ],
  
  // 업스트림 우선 (코어 업데이트)
  upstreamPriority: [
    'package.json[dependencies]',
    'astro.config.mjs',
    'tsconfig.json',
    'migrations/*.sql'
  ],
  
  // 수동 결정 필요
  manual: [
    'src/components/**/*.tsx',
    'src/lib/**/*.ts',
    'README.md'
  ]
};
```
