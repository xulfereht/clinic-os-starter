# SPEC-UI-002: Implementation Plan

## Design Decisions (Approved 2026-02-01)

- **Theme**: Light mode (white background, green accents)
- **Editor Width**: Full width (remove max-width: 800px constraint)
- **Layout**: Split view 50:50 (editor + preview)
- **Mockup**: pencil-new.pen - "Post Editor - Light Mode" frame

## Task Decomposition

### Phase 1: Pencil Mockup Design [COMPLETED]
**Priority**: High
**Status**: Done

1. **Pencil 앱에서 새 디자인 목업** - DONE
   - 라이트 모드 테마 (흰색 배경, 초록 액센트)
   - 향상된 툴바 디자인 (아이콘 + 텍스트 + 툴팁)
   - 자동저장 상태 표시 UI (✓ 저장됨 HH:MM)
   - 드래프트 복구 배너 디자인 (복구/삭제 버튼)
   - 모바일 레이아웃 (단일 컬럼 + 미리보기 토글)

2. **디자인 리뷰 및 승인** - DONE

### Phase 2: Autosave & Draft Recovery
**Priority**: High
**Estimated Complexity**: Medium

1. **localStorage 드래프트 저장 구현**
   - 저장 키: `hq-draft-{userId}-{type}` (type: new, edit-{postId})
   - 저장 데이터: { title, content, category, tags, savedAt }
   - 10초 간격 자동저장 (debounced)
   - 1MB 크기 제한 체크

2. **드래프트 복구 UI**
   - 페이지 로드 시 드래프트 존재 확인
   - 복구 배너: 미리보기 + 저장 시각 + 복구/삭제 버튼
   - 복구 시 폼 필드에 데이터 로드

3. **저장 상태 표시**
   - 저장 중: 스피너 + "저장 중..."
   - 저장 완료: 체크마크 + "저장됨 (HH:MM)"
   - 저장 실패: 경고 아이콘 + "저장 실패"

4. **페이지 이탈 경고**
   - beforeunload 이벤트로 변경 감지
   - 변경 사항 있을 때만 경고 표시

### Phase 3: Keyboard Shortcuts & Enhanced Toolbar
**Priority**: High
**Estimated Complexity**: Medium

1. **키보드 단축키 구현**
   | 단축키 | Windows/Linux | Mac | 기능 |
   |--------|---------------|-----|------|
   | Bold | Ctrl+B | Cmd+B | `**text**` |
   | Italic | Ctrl+I | Cmd+I | `*text*` |
   | Link | Ctrl+K | Cmd+K | `[text](url)` |
   | Save | Ctrl+S | Cmd+S | 수동 저장 |
   | Heading | Ctrl+H | Cmd+H | `# heading` |
   | Quote | Ctrl+Q | Cmd+Q | `> quote` |
   | Code | Ctrl+` | Cmd+` | `` `code` `` |

2. **향상된 툴바**
   - 아이콘 + 텍스트 레이블 (접기 가능)
   - 호버 시 툴팁 (기능 + 단축키)
   - 그룹핑: [서식] [삽입] [미디어]
   - 반응형: 좁은 화면에서 아이콘만 표시

3. **단축키 도움말 모달**
   - `?` 키로 열기
   - 모든 단축키 목록 표시

### Phase 4: Accessibility & Responsive
**Priority**: Medium
**Estimated Complexity**: Medium

1. **접근성 개선**
   - 툴바 버튼에 ARIA labels
   - 에디터 textarea에 aria-describedby
   - 미리보기에 aria-live="polite"
   - 저장 상태에 aria-live="assertive"
   - 포커스 표시 (outline) 강화
   - 키보드로 툴바 탐색 (Tab, Arrow keys)

2. **반응형 개선**
   - 768px 이하: 단일 컬럼 레이아웃
   - 미리보기 토글 버튼 (접기/펼치기)
   - 툴바 스크롤 또는 오버플로우 메뉴
   - 터치 친화적 버튼 크기 (최소 44px)

3. **다크 모드 일관성**
   - 에디터 영역도 터미널 스타일 적용
   - 코드 블록 문법 하이라이팅 색상

### Phase 5: Edit Page Enhancement
**Priority**: Medium
**Estimated Complexity**: Low

1. **카테고리 편집 추가**
   - 수정 페이지에 카테고리 셀렉트 표시
   - 관리자 전용 카테고리 제한 유지

2. **태그 편집 추가**
   - 수정 페이지에 태그 입력 필드 표시
   - 기존 태그 표시 및 삭제 가능

3. **API 업데이트**
   - PUT /api/board/posts/{id}에 category, tags 파라미터 추가
   - 검증 로직 적용 (admin-only categories, max 3 tags)

---

## Implementation Details

### localStorage 스키마

```javascript
// Draft storage key
const DRAFT_KEY = `hq-draft-${userId}-${type}`;

// Draft data structure
{
  title: string,
  content: string,
  category: string,
  tags: string[],
  savedAt: number (timestamp),
  version: 1
}
```

### 자동저장 디바운스 로직

```javascript
let saveTimeout;
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDraft();
  }, 10000);
}

// On content change
contentInput.addEventListener('input', () => {
  updatePreview();
  scheduleSave();
  setUnsavedChanges(true);
});
```

### 키보드 단축키 핸들러

```javascript
document.addEventListener('keydown', (e) => {
  const isMac = navigator.platform.includes('Mac');
  const modifier = isMac ? e.metaKey : e.ctrlKey;

  if (modifier && e.key === 'b') {
    e.preventDefault();
    wrapSelection('**', '**');
  }
  // ... other shortcuts
});
```

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| localStorage 용량 초과 | Low | Medium | 1MB 제한 체크, 오래된 드래프트 자동 삭제 |
| 단축키 충돌 (브라우저 기본) | Medium | Low | 표준 단축키 사용, 충돌 시 대체키 제공 |
| 모바일 키보드 단축키 미지원 | High | Low | 모바일에서는 툴바 버튼으로 대체 |
| 접근성 테스트 부족 | Medium | Medium | 스크린 리더 테스트 필수, Lighthouse 검증 |

---

## Dependencies

- Phase 1 완료 후 Phase 2-5 병렬 진행 가능
- Phase 3의 툴바 개선은 Phase 1 목업 기준
- Phase 4의 반응형은 Phase 1 모바일 목업 기준
