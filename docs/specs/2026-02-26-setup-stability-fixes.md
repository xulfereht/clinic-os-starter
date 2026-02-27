# SPEC: clinic-os npm run setup 안정성 개선

## Background

`npm run setup` 실행 시 여러 가지 문제가 발생하고 있음:

1. **인터랙티브 입력 대기** — 에이전트/자동화 환경에서 `--auto` 플래그 없이 실행하면 readline 입력 대기로 무한 블록
2. **Step 11 멈춤** — `fetch.js` 실행 시 사용자 확인 프롬프트로 인해 진행 불가
3. **마이그레이션 오류** — `wrangler d1 execute` 실행 시 SQLITE_BUSY, lock 등으로 실패
4. **배포 시 core/dist 경로 혼란** — 스타터킷 구조에서 빌드 출력 경로 불일치

## Goals

1. 자동화 환경에서도 안정적으로 setup 완료
2. 마이그레이션 실패 시 자동 재시도
3. 배포 경로 명확화

## Definition of Done

- [ ] `npm run setup -- --auto` 실행 시 사용자 입력 없이 완료
- [ ] Step 11(fetch.js)에 `--yes` 플래그 자동 전달
- [ ] Step 8(마이그레이션)에 SQLITE_BUSY 재시도 로직 추가
- [ ] `astro.config.mjs`의 `outDir`과 `wrangler.toml`의 `pages_build_output_dir` 동기화
- [ ] 구형 모델 배포 가이드 문서 추가

## Files to Modify

| 파일 | 변경 내용 |
|------|----------|
| `scripts/setup-clinic.js` | `--auto` 플래그 개선, Step 11에 `--yes` 전달, Step 8 재시도 로직 추가 |
| `astro.config.mjs` | `outDir` 설정 명시적 추가 |
| `docs/DEPLOYMENT_PATHS.md` | (신규) 배포 경로 가이드 |

## Technical Details

### 1. setup-clinic.js 개선사항

#### 1.1 --auto 플래그 감지 개선
```javascript
// 현재: 단순 argv 체크
const IS_AUTO = process.argv.includes('--auto');

// 개선: 환경 변수도 지원
const IS_AUTO = process.argv.includes('--auto') || process.env.CI === 'true' || process.env.CLINIC_OS_AUTO === 'true';
```

#### 1.2 Step 11 개선 (fetch.js에 --yes 전달)
```javascript
// 현재:
const fetchCmd = `node .docking/engine/fetch.js ${fetchArgs}`;

// 개선:
const fetchCmd = `node .docking/engine/fetch.js ${fetchArgs} --yes`;
```

#### 1.3 Step 8 재시도 로직 추가
`fetch.js`의 `executeWithRetry` 함수 패턴을 참고하여 setup-clinic.js에도 적용:

```javascript
async function executeWithRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (error.message.includes('SQLITE_BUSY') && i < maxRetries - 1) {
                const delay = Math.pow(2, i) * 1000; // exponential backoff
                console.log(`   ⏳ SQLITE_BUSY, ${delay}ms 후 재시도 (${i + 1}/${maxRetries})...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
}
```

### 2. astro.config.mjs outDir 설정

```javascript
import { defineConfig } from 'astro/config';
import path from 'path';

const IS_STARTER_KIT = fs.existsSync(path.join(process.cwd(), 'core', 'package.json'));

export default defineConfig({
    // ... existing config
    outDir: IS_STARTER_KIT ? './core/dist' : './dist',
    // ...
});
```

### 3. wrangler.toml 확인

`pages_build_output_dir`가 `astro.config.mjs`의 `outDir`과 일치하는지 확인:

```toml
# 스타터킷 구조
pages_build_output_dir = "core/dist"  # 또는 "dist" (일치 필요)

# 일반 구조  
pages_build_output_dir = "dist"
```

## Tests

### Test 1: --auto 모드 테스트
```bash
cd /tmp
git clone <test-repo>
cd clinic-os-test
CI=true npm run setup
# → 사용자 입력 없이 완료되어야 함
```

### Test 2: 마이그레이션 재시도 테스트
```bash
# wrangler dev를 별도 터미널에서 실행 (DB lock 유발)
# setup 실행 시 SQLITE_BUSY 발생 후 재시도 확인
npm run setup -- --auto
```

### Test 3: 빌드 경로 테스트
```bash
npm run build
# 스타터킷: core/dist/에 출력 확인
# 일반: dist/에 출력 확인
```

## Implementation Notes

- 기존 동작을 유지하면서 개선 (breaking change 없음)
- `--auto` 없이 실행 시 기존 인터랙티브 모드 유지
- 마이그레이션 재시도는 실패 시에만 로그 출력 (성공 시 조용히 진행)

## References

- `memory/ops/ccq-bypass-runbook.md`
- `.docking/engine/fetch.js` (retry 로직 참고)
- `.docking/engine/schema-validator.js` (executeWithRetry 구현)
