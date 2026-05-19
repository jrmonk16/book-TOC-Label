"""
PDF 페이지 라벨 주입 스크립트 (PyMuPDF)
사용법: python add_page_labels.py <input.pdf> <output.pdf> <offset>

offset 의미:
  logical_page = physical_page + offset  (1-based 기준)

  offset > 0:  앞에 front matter가 있는 경우
    예: offset=10 → 물리 1~10은 로마숫자(i~x), 물리 11부터 아라비아(1,2,3...)
    
  offset = 0:  물리 1 = 논리 1
  
  offset < 0:  PDF가 책의 중간부터 시작하는 경우
    예: offset=-2 → 물리 1 = 논리 3, 물리 2 = 논리 4, ...
"""
import fitz
import sys

def main():
    if len(sys.argv) < 4:
        print("Usage: python add_page_labels.py <input.pdf> <output.pdf> <offset>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    offset = int(sys.argv[3])

    doc = fitz.open(input_path)

    labels = []
    if offset > 0:
        # Front matter: lowercase roman numerals for first `offset` pages
        labels.append({
            "startpage": 0,
            "style": "r",
            "prefix": "",
            "firstpagenum": 1,
        })
        # Body: arabic numerals starting at 1
        labels.append({
            "startpage": offset,  # 0-based index
            "style": "D",
            "prefix": "",
            "firstpagenum": 1,
        })
    elif offset < 0:
        # PDF starts in the middle of the book
        # Physical page 1 = logical page (1 - offset) = (1 + abs(offset))
        first_label = 1 - offset  # e.g., offset=-2 → first_label=3
        labels.append({
            "startpage": 0,
            "style": "D",
            "prefix": "",
            "firstpagenum": first_label,
        })
    else:
        # No offset: all pages arabic from 1
        labels.append({
            "startpage": 0,
            "style": "D",
            "prefix": "",
            "firstpagenum": 1,
        })

    doc.set_page_labels(labels)
    doc.save(output_path, garbage=0, deflate=True)
    doc.close()
    print(f"OK:{output_path}")

if __name__ == "__main__":
    main()
