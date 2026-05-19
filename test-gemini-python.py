import fitz
import json
import urllib.request
import os

def check_gemini():
    # 1. Load env key
    key = None
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                if line.startswith('GEMINI_API_KEY='):
                    key = line.strip().split('=', 1)[1]
                    break
    if not key:
        print("No key")
        return

    # 2. Extract text from first 10 pages using PyMuPDF (similar to pdf.js behavior in App)
    doc = fitz.open('../pdf_label/scan_raw.pdf')
    text = ""
    for i in range(min(10, doc.page_count)):
        text += f"\n--- Page {i+1} ---\n"
        text += doc[i].get_text("text")

    # Compress whitespace to simulate App.tsx
    import re
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # 3. Request Gemini
    prompt = f"""다음 텍스트는 책의 앞부분 내용입니다. 이 안에서 목차(Table of Contents)와 각 항목에 해당하는 '문서에 적힌 실제 논리 페이지 번호'를 추출해 주세요.
반드시 아래 JSON 배열 형식으로만 응답해야 합니다. 다른 말이나 마크다운 백틱 문법 등은 넣지 마세요.
[
  {{ "title": "항목 제목", "page": 페이지숫자, "level": 트리 레벨(1, 2, 3...) }}
]

텍스트:
{text}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    req_data = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 8192,
            "responseMimeType": "application/json"
        }
    }).encode('utf-8')
    
    req = urllib.request.Request(url, data=req_data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            print("Gemini API Request Succeeded!")
            gemini_text = res_data['candidates'][0]['content']['parts'][0]['text']
            print("\n--- RAW TEXT ---")
            print(gemini_text)
            
            # Try parsing
            try:
                parsed = json.loads(gemini_text)
                print("\n--- JSON PARSE SUCCESS ---")
                print(type(parsed))
            except Exception as e:
                print("\n--- JSON PARSE FAILED ---", e)
    except Exception as e:
        print("Gemini API Request Failed:", e)

if __name__ == "__main__":
    check_gemini()
