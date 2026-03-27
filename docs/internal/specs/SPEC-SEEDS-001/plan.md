# SPEC-SEEDS-001: 구현 계획

---
spec_id: SPEC-SEEDS-001
version: "1.0.0"
created: "2025-01-30"
---

## 1. 마일스톤

### Primary Goal: Seeds Manifest 시스템

**범위**: REQ-S01, REQ-E02

**산출물**:
- `seeds/seeds.manifest.json` 생성
- `fetch.js`에 manifest 기반 실행 로직 추가

**작업 항목**:
1. seeds.manifest.json 스키마 정의
2. 기존 27개 Seeds 분류 및 manifest 등록
3. manifest 파서 구현
4. 카테고리/의존성 기반 실행 순서 결정

**의존성**: 없음

---

### Secondary Goal: Idempotency 표준화

**범위**: REQ-E01, REQ-N02

**산출물**:
- UNIQUE constraint 오류 처리 표준화
- Seed 파일 주석 규칙 정의

**작업 항목**:
1. UNIQUE 오류 catch 및 skip 로직 추가
2. 기존 Seeds 파일 검토 (INSERT OR IGNORE 사용 여부)
3. Seed 파일 헤더 주석 표준 정의
4. 비멱등성 파일 목록 작성 및 개선 계획

**의존성**: Primary Goal 완료 권장

---

### Tertiary Goal: 환경별 적용 제어

**범위**: REQ-S03, REQ-N03, REQ-E04

**산출물**:
- `--category` 옵션 지원
- `--env` 옵션으로 production sample 스킵

**작업 항목**:
1. CLI 옵션 파싱 추가
2. 환경 감지 로직 (ENVIRONMENT 변수)
3. 카테고리 필터링 로직
4. Production 환경에서 sample 기본 스킵

**의존성**: Primary Goal, Secondary Goal 완료 후

---

### Optional Goal: 버전 호환성 체크

**범위**: REQ-S02

**산출물**:
- `-- min-version:` 주석 파서
- 버전 비교 로직

**작업 항목**:
1. Seed 파일 min-version 주석 파서
2. 현재 코어 버전과 비교 로직
3. 버전 미달 시 스킵 및 경고

**의존성**: Tertiary Goal 완료 후 (고급 기능)

---

### Critical Goal: Retry 메커니즘 (SPEC-CORE-001 연동)

**범위**: REQ-E05, REQ-N04

**산출물**:
- Seeds 실행에 Exponential Backoff 재시도 적용
- SQLITE_BUSY 오류 처리 표준화

**작업 항목**:
1. SPEC-CORE-001의 `executeWithRetry()` 함수 재사용
2. Seeds 실행 루프에 재시도 래퍼 적용
3. 재시도 로그 출력 (일관성 유지)

**의존성**: SPEC-CORE-001 Secondary Goal 완료 후 (함수 재사용)

---

### Critical Goal: Seeds Lockfile

**범위**: REQ-S04, REQ-E08

**산출물**:
- `seeds/seeds.lock` 파일 생성 및 관리 로직
- Checksum 기반 변경 감지

**작업 항목**:
1. Lockfile 스키마 정의 및 파서 구현
2. SHA-256 checksum 계산 함수
3. Lockfile 생성/갱신/동기화 로직
4. 변경 감지 및 --changed-only 옵션 구현

**의존성**: Primary Goal 완료 후

**코드 구조**:

```javascript
// seeds/seeds.lock 관리
import crypto from 'crypto';

function calculateChecksum(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return 'sha256:' + crypto.createHash('sha256')
        .update(content)
        .digest('hex')
        .substring(0, 16);
}

async function updateLockfile(seedsDir, appliedSeeds) {
    const lockPath = path.join(seedsDir, 'seeds.lock');
    const lock = {
        version: '1.0.0',
        generated_at: new Date().toISOString(),
        core_version: await readCoreVersion(),
        applied: appliedSeeds.map(s => ({
            file: s.file,
            category: s.category,
            checksum: calculateChecksum(path.join(seedsDir, s.file)),
            applied_at: s.applied_at
        }))
    };
    fs.writeJsonSync(lockPath, lock, { spaces: 2 });
}

function detectChangedSeeds(seedsDir, manifest) {
    const lockPath = path.join(seedsDir, 'seeds.lock');
    if (!fs.existsSync(lockPath)) return manifest.seeds;

    const lock = fs.readJsonSync(lockPath);
    const appliedMap = new Map(lock.applied.map(s => [s.file, s.checksum]));

    return manifest.seeds.filter(seed => {
        const currentChecksum = calculateChecksum(path.join(seedsDir, seed.file));
        const appliedChecksum = appliedMap.get(seed.file);
        return !appliedChecksum || currentChecksum !== appliedChecksum;
    });
}
```

---

### Critical Goal: Health Check

**범위**: REQ-E06, REQ-S05

**산출물**:
- Health Check 검증 로직
- 검증 결과 리포팅

**작업 항목**:
1. 필수 테이블/데이터 검증 규칙 정의
2. Health Check 실행 함수 구현
3. Lockfile에 Health Check 결과 기록
4. 검증 실패 시 경고 및 가이드 출력

**의존성**: Seeds Lockfile 완료 후

---

### Optional Goal: Seeds Reset

**범위**: REQ-E07, REQ-N05

**산출물**:
- --reset 옵션 구현
- is_sample 마킹 표준 및 가이드

**작업 항목**:
1. is_sample 컬럼 존재 확인 및 마이그레이션
2. Reset 로직 구현 (sample 카테고리 우선)
3. Production 환경 보호 로직
4. 기존 sample Seeds에 is_sample 마킹 가이드

**의존성**: Health Check 완료 후 (고급 기능)

---

## 2. 기술 접근

### 2.1 Manifest 파서

```javascript
async function loadSeedsManifest(seedsDir) {
    const manifestPath = path.join(seedsDir, 'seeds.manifest.json');

    if (!fs.existsSync(manifestPath)) {
        // 하위 호환: manifest 없으면 기존 동작
        return null;
    }

    try {
        const content = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(content);

        // 스키마 검증 (기본)
        if (!manifest.seeds || !Array.isArray(manifest.seeds)) {
            console.log('   ⚠️  seeds.manifest.json 형식 오류');
            return null;
        }

        return manifest;
    } catch (e) {
        console.log(`   ⚠️  seeds.manifest.json 파싱 실패: ${e.message}`);
        return null;
    }
}
```

### 2.2 카테고리 기반 실행

```javascript
async function runSeedsByCategory(seedsDir, options = {}) {
    const { category = null, env = 'development' } = options;
    const manifest = await loadSeedsManifest(seedsDir);

    if (!manifest) {
        // Fallback: 기존 동작 (전체 SQL 순서대로)
        return runAllSeedsLegacy(seedsDir, options);
    }

    // 카테고리 정의 순서대로 정렬
    const categoryOrder = Object.entries(manifest.categories)
        .sort((a, b) => a[1].order - b[1].order)
        .map(([name]) => name);

    // 실행할 Seeds 필터링
    let seedsToRun = manifest.seeds;

    // 카테고리 필터
    if (category) {
        seedsToRun = seedsToRun.filter(s => s.category === category);
    }

    // 환경 필터 (production에서 sample 스킵)
    if (env === 'production') {
        seedsToRun = seedsToRun.filter(s => s.category !== 'sample');
    }

    // 카테고리 순서 + 의존성 정렬
    seedsToRun = sortByDependencies(seedsToRun, categoryOrder);

    // 실행
    for (const seed of seedsToRun) {
        await executeSeed(seedsDir, seed, options);
    }
}
```

### 2.3 의존성 정렬

```javascript
function sortByDependencies(seeds, categoryOrder) {
    // 1. 카테고리 순서로 1차 정렬
    const byCategoryOrder = [...seeds].sort((a, b) => {
        const orderA = categoryOrder.indexOf(a.category);
        const orderB = categoryOrder.indexOf(b.category);
        return orderA - orderB;
    });

    // 2. 의존성 위상 정렬
    const graph = new Map();
    for (const seed of byCategoryOrder) {
        graph.set(seed.file, seed.depends_on || []);
    }

    return topologicalSort(graph, byCategoryOrder);
}
```

### 2.4 Idempotent 실행

```javascript
async function executeSeed(seedsDir, seed, options = {}) {
    const { dbName, isLocal = true } = options;
    const filePath = path.join(seedsDir, seed.file);
    const localFlag = isLocal ? '--local' : '--remote';

    try {
        const result = await runCommand(
            `npx wrangler d1 execute ${dbName} ${localFlag} --file="${filePath}" --yes 2>&1`,
            PROJECT_ROOT,
            true
        );

        if (result.success) {
            await recordSeed(dbName, seed.file, seed.category);
            console.log(`   ✅ ${seed.file} (${seed.category})`);
            return { success: true };
        }

        // UNIQUE constraint 오류는 성공으로 처리
        const output = result.stdout + result.stderr;
        if (output.includes('UNIQUE constraint failed')) {
            await recordSeed(dbName, seed.file, seed.category);
            console.log(`   ⏭️  ${seed.file}: 데이터 이미 존재`);
            return { success: true, skipped: true };
        }

        // 기타 오류
        console.log(`   ⚠️  ${seed.file}: ${output.substring(0, 100)}`);
        return { success: false, error: output };

    } catch (e) {
        console.log(`   ❌ ${seed.file}: ${e.message}`);
        return { success: false, error: e.message };
    }
}
```

---

## 3. Seeds 분류 계획

### 3.1 현재 Seeds 분석 및 분류

| 파일 | 제안 카테고리 | Idempotent | 의존성 |
|------|---------------|------------|--------|
| seed_templates.sql | system | Y | - |
| terms_definitions.sql | system | Y | - |
| terms_versions.sql | system | Y | terms_definitions |
| seed_manuals.sql | system | Y | - |
| seed_system_manuals.sql | system | Y | - |
| seed_patient_tags.sql | system | Y | - |
| program_translations_complete.sql | translation | Y | - |
| program_translations_sample.sql | translation | Y | - |
| program_translations_overlay.sql | translation | Y | - |
| sample_data.sql | sample | 검토 필요 | - |
| sample_clinic.sql | sample | Y | - |
| sample_patients.sql | sample | Y | sample_clinic |
| sample_faqs.sql | sample | Y | - |
| sample_notices.sql | sample | Y | - |
| sample_ops_data.sql | sample | Y | sample_clinic |
| dummy_posts.sql | sample | Y | - |
| dummy_reviews.sql | sample | Y | - |
| prepare_samples.sql | sample | Y | - |
| surveys.sql | plugin | Y | - |
| self_diagnosis_templates.sql | plugin | Y | - |
| add_plugins_local.sql | plugin | Y | - |
| knowledge_cards.sql | system | Y | - |
| knowledge_seed.sql | system | Y | - |
| default_pages.sql | system | Y | - |
| go_live.sql | system | Y | - |
| seed_digestive_content.sql | translation | Y | - |
| generated_faqs.sql | sample | Y | - |

### 3.2 Manifest 초안

```json
{
  "version": "1.0.0",
  "min_core_version": "v1.2.0",
  "categories": {
    "system": { "order": 1, "auto_apply": true },
    "translation": { "order": 2, "auto_apply": true },
    "sample": { "order": 3, "auto_apply": false, "environments": ["development"] },
    "plugin": { "order": 4, "auto_apply": false }
  },
  "seeds": [
    { "file": "seed_templates.sql", "category": "system" },
    { "file": "terms_definitions.sql", "category": "system" },
    { "file": "terms_versions.sql", "category": "system", "depends_on": ["terms_definitions.sql"] },
    { "file": "default_pages.sql", "category": "system" },
    { "file": "knowledge_cards.sql", "category": "system" },
    { "file": "knowledge_seed.sql", "category": "system" },
    { "file": "seed_manuals.sql", "category": "system" },
    { "file": "seed_system_manuals.sql", "category": "system" },
    { "file": "seed_patient_tags.sql", "category": "system" },
    { "file": "go_live.sql", "category": "system" },
    { "file": "program_translations_complete.sql", "category": "translation" },
    { "file": "program_translations_sample.sql", "category": "translation" },
    { "file": "program_translations_overlay.sql", "category": "translation" },
    { "file": "seed_digestive_content.sql", "category": "translation" },
    { "file": "sample_clinic.sql", "category": "sample" },
    { "file": "sample_patients.sql", "category": "sample", "depends_on": ["sample_clinic.sql"] },
    { "file": "sample_data.sql", "category": "sample" },
    { "file": "sample_faqs.sql", "category": "sample" },
    { "file": "sample_notices.sql", "category": "sample" },
    { "file": "sample_ops_data.sql", "category": "sample", "depends_on": ["sample_clinic.sql"] },
    { "file": "dummy_posts.sql", "category": "sample" },
    { "file": "dummy_reviews.sql", "category": "sample" },
    { "file": "prepare_samples.sql", "category": "sample" },
    { "file": "generated_faqs.sql", "category": "sample" },
    { "file": "surveys.sql", "category": "plugin" },
    { "file": "self_diagnosis_templates.sql", "category": "plugin" },
    { "file": "add_plugins_local.sql", "category": "plugin" }
  ]
}
```

---

## 4. 테스트 전략

### 4.1 단위 테스트

| 대상 | 테스트 케이스 |
|------|---------------|
| `loadSeedsManifest()` | 유효/무효 JSON 파싱 |
| `sortByDependencies()` | 의존성 순서 정확성 |
| `executeSeed()` | UNIQUE 오류 처리 |

### 4.2 통합 테스트

```bash
# 1. 깨끗한 DB에서 전체 Seeds 실행
rm -rf .wrangler/state
npm run db:init
npm run db:seed

# 2. 카테고리별 실행
npm run db:seed -- --category=system
npm run db:seed -- --category=sample

# 3. Production 환경 시뮬레이션
ENVIRONMENT=production npm run db:seed

# 4. 중복 실행 (Idempotency 테스트)
npm run db:seed
npm run db:seed  # 오류 없이 완료되어야 함
```

---

## 5. 배포 전략

### 5.1 점진적 롤아웃

1. **Phase 1**: seeds.manifest.json 추가 (기존 동작 유지)
2. **Phase 2**: fetch.js에 manifest 지원 추가
3. **Phase 3**: CLI 옵션 추가
4. **Phase 4**: 기존 Seeds 파일 주석 표준화

### 5.2 하위 호환성

- manifest 없으면 기존 동작 (전체 SQL 알파벳 순)
- d1_seeds 테이블 스키마 변경 없음 (컬럼 추가는 선택적)

---

## 6. 리소스 추정

| 작업 | 복잡도 | 예상 노력 |
|------|--------|-----------|
| Seeds Manifest 시스템 | 중 | 중간 |
| Idempotency 표준화 | 저 | 낮음 |
| 환경별 적용 제어 | 저 | 낮음 |
| Retry 메커니즘 | 저 | 낮음 (SPEC-CORE-001 재사용) |
| Seeds Lockfile | 중 | 중간 |
| Health Check | 중 | 중간 |
| Seeds Reset | 중 | 중간 (선택적) |
| 버전 호환성 체크 | 중 | 중간 (선택적) |

---

## 7. 체크리스트

### 구현 전 확인사항

- [ ] 현재 27개 Seeds 파일 전수 분석
- [ ] 각 파일의 Idempotency 여부 확인
- [ ] d1_seeds 테이블 현재 데이터 확인

### 구현 후 확인사항

- [ ] 기존 db:seed 명령어 정상 동작
- [ ] manifest 기반 실행 검증
- [ ] UNIQUE 오류 처리 검증
- [ ] Production 환경 sample 스킵 검증
- [ ] SQLITE_BUSY 재시도 검증
- [ ] Lockfile 생성 및 동기화 검증
- [ ] Health Check 실행 및 리포트 검증
- [ ] --changed-only 옵션 동작 검증
- [ ] --reset 옵션 동작 검증 (개발 환경)
