import fs from 'fs';

async function testGemini() {
  // Use the env key
  const envContent = fs.readFileSync('.env', 'utf-8');
  const match = envContent.match(/GEMINI_API_KEY=(.+)/);
  if (!match || !match[1]) {
    console.log("No API Key found");
    return;
  }
  const key = match[1].trim();
  
  const prompt = `다음 텍스트는 책의 앞부분 내용입니다. 이 안에서 목차(Table of Contents)와 각 항목에 해당하는 '문서에 적힌 실제 논리 페이지 번호'를 추출해 주세요.
반드시 아래 JSON 배열 형식으로만 응답해야 합니다. 다른 말이나 마크다운 백틱 문법 등은 넣지 마세요.
[
  { "title": "항목 제목", "page": 페이지숫자, "level": 트리 레벨(1, 2, 3...) }
]

텍스트:
1장 서론 ... 1
2장 본론 ... 2`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  const geminiData = await res.json();
  console.log(JSON.stringify(geminiData, null, 2));
}

testGemini();
