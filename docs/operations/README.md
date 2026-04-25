# 운영 아키텍처 결정 (ADR)

현재 운영 중인 핵심 아키텍처 결정. 변경 시 새 ADR 추가, 폐기된 결정은 Status: Deprecated 후 보존.

## ADR 형식

```markdown
# {Topic}

**Status**: Proposed | Accepted | Deprecated
**Date**: YYYY-MM-DD
**Decision Makers**: [이름]

## Context
왜 결정이 필요한가? 어떤 제약/문제가 있었는가?

## Decision
무엇을 선택했는가? 다른 옵션은 왜 기각했는가?

## Consequences
- 긍정적 결과
- 부정적 결과 / 트레이드오프
- 검증 방법
```

## 현재 결정 목록

| 문서 | 결정 | 상태 |
|---|---|---|
| [polling-architecture.md](polling-architecture.md) | SSE → 폴링 전환 (Railway 호환성) | Accepted (2026-03-23) |
