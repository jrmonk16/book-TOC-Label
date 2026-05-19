# PDF TOC LLM

스캔 PDF에 **북마크(목차)** 와 **페이지 라벨**을 삽입하는 데스크탑 앱.  
Gemini(클라우드) 또는 Ollama(로컬 LLM)를 사용해 목차를 자동 감지합니다.

## 다운로드 (바로 설치)

👉 **[Releases 페이지](https://github.com/jrmonk16/book-TOC-Label/releases)** 에서 최신 `.dmg` 파일 다운로드 → 더블클릭 → Applications 드래그

> ⚠️ 서명되지 않은 앱이라 처음 열 때: **우클릭 → 열기** 로 실행

---

## 개발자용 빠른 시작 (3단계)

```bash
# 1. 받기
git clone https://github.com/jrmonk16/book-TOC-Label.git && cd book-TOC-Label

# 2. 설치
npm install

# 3. 실행
npm run electron:dev
```

> Node.js 18 이상 필요. [nodejs.org](https://nodejs.org)에서 설치.

## Gemini API 키 설정

```bash
cp .env.example .env
# .env 파일을 열고 VITE_GEMINI_API_KEY= 뒤에 키 입력
```

[Google AI Studio](https://aistudio.google.com/apikey)에서 무료 API 키 발급.

## 주요 기능

| 기능 | 설명 |
|---|---|
| AI 목차 감지 | Gemini 2.5 Flash 또는 로컬 Ollama 모델로 PDF 목차 자동 추출 |
| 오프셋 자동 계산 | `PDF N쪽 = 책 M쪽` 입력 시 오프셋 자동 산출 |
| 북마크 삽입 | 계층 구조(H1~H4) 북마크를 PDF에 직접 삽입 |
| 페이지 라벨 | 앞부속(로마 숫자 i,ii,iii...)과 본문(1,2,3...) 자동 구분 |
| PDF 미리보기 | 오른쪽 패널에서 페이지 확인 후 즉시 다운로드 |

## 배포용 앱 빌드 (선택)

```bash
npm run electron:build
# release/ 폴더에 .dmg 와 .app 생성
```

## Ollama 사용 시

```bash
# Ollama 설치 후
ollama pull gemma3:27b   # 또는 원하는 모델
ollama serve             # 서버 시작

# 앱 모달에서 "Ollama (로컬)" 선택 → 모델 드롭다운에 자동 표시
```
