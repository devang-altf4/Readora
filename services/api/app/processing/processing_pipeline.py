import fitz  # PyMuPDF
import json
import html
import io
from typing import Dict, Any, List, Tuple, Optional
from PIL import Image

class ProcessingPipeline:
    def process_pdf(self, pdf_bytes: bytes, book_id: str) -> Dict[str, Any]:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            return {
                "success": False,
                "error": {
                    "code": "CORRUPT_PDF",
                    "message": f"Could not open PDF file: {str(e)}",
                    "stage": "opening_pdf"
                }
            }

        page_count = len(doc)
        if page_count == 0:
            doc.close()
            return {
                "success": False,
                "error": {
                    "code": "EMPTY_PDF",
                    "message": "PDF contains zero pages.",
                    "stage": "opening_pdf"
                }
            }

        metadata = doc.metadata or {}
        title = metadata.get("title", "").strip()
        author = metadata.get("author", "").strip()

        # Cover image generation from first page
        cover_bytes = None
        try:
            first_page = doc[0]
            cover_bytes = self._generate_cover_image(first_page)
        except Exception:
            pass

        # Text and Structure Extraction with paragraph reconstruction
        blocks, text_page_count, total_chars, total_words, heading_count = self._extract_blocks(doc)

        document_type = "text_based"
        if text_page_count == 0 or total_chars < 100:
            document_type = "scanned_or_image_only"

        # Reflow HTML & JSON generation
        html_content = self._generate_safe_html(title or f"Book {book_id}", blocks)

        json_data = {
            "bookId": book_id,
            "title": title,
            "author": author,
            "pageCount": page_count,
            "documentType": document_type,
            "stats": {
                "characterCount": total_chars,
                "wordCount": total_words,
                "headingCount": heading_count,
                "imageCount": 0
            },
            "blocks": blocks
        }

        doc.close()

        return {
            "success": True,
            "title": title,
            "author": author,
            "pageCount": page_count,
            "textPageCount": text_page_count,
            "documentType": document_type,
            "coverBytes": cover_bytes,
            "htmlContent": html_content,
            "jsonContent": json.dumps(json_data, ensure_ascii=False, indent=2),
            "stats": {
                "characterCount": total_chars,
                "wordCount": total_words,
                "headingCount": heading_count,
                "imageCount": 0
            }
        }

    def _generate_cover_image(self, page: fitz.Page, max_dim: int = 800) -> bytes:
        pix = page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes()))
        img.thumbnail((max_dim, max_dim))
        
        output = io.BytesIO()
        img.convert("RGB").save(output, format="JPEG", quality=85)
        return output.getvalue()

    def _extract_blocks(self, doc: fitz.Document) -> Tuple[List[Dict[str, Any]], int, int, int, int]:
        blocks = []
        text_page_count = 0
        total_chars = 0
        total_words = 0
        heading_count = 0

        for page_index, page in enumerate(doc):
            page_num = page_index + 1
            page_text = page.get_text("text").strip()
            
            if page_text:
                text_page_count += 1
                total_chars += len(page_text)
                words = page_text.split()
                total_words += len(words)

                # Page break marker
                if page_index > 0:
                    blocks.append({
                        "type": "page_break",
                        "sourcePage": page_num
                    })

                lines = page_text.split("\n")
                current_para = []

                for line in lines:
                    line_clean = line.strip()
                    if not line_clean:
                        if current_para:
                            blocks.append({
                                "type": "paragraph",
                                "text": " ".join(current_para),
                                "sourcePage": page_num
                            })
                            current_para = []
                    elif len(line_clean) < 60 and (line_clean.isupper() or line_clean.startswith("Chapter") or line_clean.startswith("Part")):
                        if current_para:
                            blocks.append({
                                "type": "paragraph",
                                "text": " ".join(current_para),
                                "sourcePage": page_num
                            })
                            current_para = []
                        blocks.append({
                            "type": "heading",
                            "text": line_clean,
                            "level": 2,
                            "sourcePage": page_num
                        })
                        heading_count += 1
                    else:
                        current_para.append(line_clean)

                if current_para:
                    blocks.append({
                        "type": "paragraph",
                        "text": " ".join(current_para),
                        "sourcePage": page_num
                    })

        return blocks, text_page_count, total_chars, total_words, heading_count

    def _generate_safe_html(self, title: str, blocks: List[Dict[str, Any]]) -> str:
        body_elements = []

        for block in blocks:
            b_type = block.get("type")
            source_page = block.get("sourcePage", 1)

            if b_type == "heading":
                text = html.escape(block.get("text", ""))
                level = block.get("level", 2)
                body_elements.append(f'<h{level} class="dindle-heading" data-page="{source_page}">{text}</h{level}>')
            elif b_type == "paragraph":
                text = html.escape(block.get("text", ""))
                body_elements.append(f'<p class="dindle-paragraph" data-page="{source_page}">{text}</p>')
            elif b_type == "page_break":
                body_elements.append(f'<div class="dindle-page-break" data-page="{source_page}"></div>')

        content_html = "\n".join(body_elements)

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>{html.escape(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');

    @font-face {{
      font-family: "Baskerville";
      src: local("Baskerville"), local("Libre Baskerville"), url('https://fonts.gstatic.com/s/librebaskerville/v14/kmKiZpq3EH-6frQdcqiB6imWg0Q8sr7F_w0.woff2') format('woff2');
      font-style: normal;
      font-weight: 400;
    }}
    @font-face {{
      font-family: "Baskerville";
      src: local("Baskerville Bold"), local("Libre Baskerville Bold"), url('https://fonts.gstatic.com/s/librebaskerville/v14/kmKhZpq3EH-6frQdcqiB6imWg0Q8sp3y3yX92vU.woff2') format('woff2');
      font-style: normal;
      font-weight: 700;
    }}
    @font-face {{
      font-family: "Baskerville";
      src: local("Baskerville Italic"), local("Libre Baskerville Italic"), url('https://fonts.gstatic.com/s/librebaskerville/v14/kmKgZpq3EH-6frQdcqiB6imWg0Q8sr7p82Pz1w.woff2') format('woff2');
      font-style: italic;
      font-weight: 400;
    }}

    :root {{
      --reader-background: #000000;
      --reader-text: #D0D0D0;
      --reader-secondary-text: #BCBCBC;
      --reader-bold-text: #D7D7D7;
      --reader-font-size: 15px;
      --reader-line-height: 1.35;
      --reader-horizontal-padding: 24px;
      --reader-top-padding: 58px;
      --reader-bottom-padding: 88px;
      --reader-paragraph-spacing: 0.68em;
    }}

    body.theme-light {{
      --reader-background: #F7F6F2;
      --reader-text: #171717;
      --reader-secondary-text: #5F635F;
      --reader-bold-text: #000000;
    }}

    body.theme-sepia {{
      --reader-background: #F3E8D2;
      --reader-text: #2C221E;
      --reader-secondary-text: #7A6B60;
      --reader-bold-text: #000000;
    }}

    body.theme-dark {{
      --reader-background: #000000;
      --reader-text: #D0D0D0;
      --reader-secondary-text: #BCBCBC;
      --reader-bold-text: #D7D7D7;
    }}

    * {{
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }}

    html, body {{
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: var(--reader-background);
      color: var(--reader-text);
    }}

    body {{
      font-family: "Libre Baskerville", "Baskerville", "Baskerville Old Face", "Hoefler Text", Georgia, serif !important;
      font-size: var(--reader-font-size);
      font-style: normal;
      font-weight: 400;
      line-height: var(--reader-line-height);

      letter-spacing: 0;
      word-spacing: normal;

      font-kerning: normal;
      font-optical-sizing: auto;
      font-synthesis: none;

      font-feature-settings: "kern" 1, "liga" 1, "clig" 1;

      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;

      overflow-wrap: normal;
      word-break: normal;

      -webkit-hyphens: auto;
      hyphens: auto;
      transition: background-color 0.2s ease, color 0.2s ease;
    }}

    .reader-container {{
      height: 100vh;
      width: 100vw;
      box-sizing: border-box;
      padding-top: var(--reader-top-padding);
      padding-bottom: var(--reader-bottom-padding);
      padding-left: 0px;
      padding-right: 0px;

      column-width: 100vw;
      column-gap: 0px;
      column-fill: auto;

      overflow-x: scroll;
      overflow-y: hidden;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }}

    .reader-container::-webkit-scrollbar {{
      display: none;
    }}

    .dindle-heading {{
      font-family: "Libre Baskerville", "Baskerville", "Baskerville Old Face", "Hoefler Text", Georgia, serif !important;
      font-weight: 700;
      margin-top: 1.4em;
      margin-bottom: 0.8em;
      line-height: 1.3;
      color: var(--reader-bold-text);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-size: 1.15em;
      padding-left: var(--reader-horizontal-padding);
      padding-right: var(--reader-horizontal-padding);
      text-align: left;
      break-inside: auto;
      scroll-snap-align: start;
    }}

    .dindle-paragraph, p {{
      font-family: "Libre Baskerville", "Baskerville", "Baskerville Old Face", "Hoefler Text", Georgia, serif !important;
      font-size: var(--reader-font-size);
      line-height: var(--reader-line-height);
      width: 100vw;
      max-width: 100vw;
      box-sizing: border-box;
      padding-left: var(--reader-horizontal-padding);
      padding-right: var(--reader-horizontal-padding);
      margin-top: 0;
      margin-left: 0;
      margin-right: 0;
      margin-bottom: var(--reader-paragraph-spacing);
      text-align: left;
      text-indent: 0;
      overflow-wrap: normal;
      word-break: normal;
      break-inside: auto;
      scroll-snap-align: start;
      orphans: 2;
      widows: 2;
    }}

    em, i {{
      font-family: "Libre Baskerville", "Baskerville", "Baskerville Old Face", "Hoefler Text", Georgia, serif !important;
      font-style: italic;
      font-weight: 400;
    }}

    strong, b {{
      font-family: "Libre Baskerville", "Baskerville", "Baskerville Old Face", "Hoefler Text", Georgia, serif !important;
      font-style: normal;
      font-weight: 700;
      color: var(--reader-bold-text);
    }}

    strong em, strong i {{
      font-family: "Libre Baskerville", "Baskerville", "Baskerville Old Face", "Hoefler Text", Georgia, serif !important;
      font-style: italic;
      font-weight: 700;
      color: var(--reader-bold-text);
    }}
  </style>
</head>
<body class="theme-dark">
  <div id="slider" class="reader-container">
    {content_html}
  </div>

  <script>
    const slider = document.getElementById('slider');
    var scrollTimeout = null;

    function updatePageInfo() {{
      const pageWidth = window.innerWidth;
      const totalWidth = slider.scrollWidth || document.documentElement.scrollWidth;
      const currentScroll = slider.scrollLeft || window.scrollX || 0;

      const currentPage = Math.max(1, Math.floor(currentScroll / pageWidth) + 1);
      const totalPages = Math.max(1, Math.ceil(totalWidth / pageWidth));
      const progress = Math.min(100, Math.round((currentPage / totalPages) * 100));

      window.ReactNativeWebView.postMessage(JSON.stringify({{
        type: 'PAGE_UPDATE',
        currentPage: currentPage,
        totalPages: totalPages,
        progress: progress
      }}));
    }}

    slider.addEventListener('scroll', function() {{
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updatePageInfo, 100);
    }});
    window.addEventListener('resize', updatePageInfo);
    setTimeout(updatePageInfo, 100);

    document.fonts.ready.then(function() {{
      const loaded = document.fonts.check('15px "Libre Baskerville"') || document.fonts.check('15px "Baskerville"');
      window.ReactNativeWebView.postMessage(JSON.stringify({{
        type: 'FONT_STATUS',
        font: 'Baskerville',
        loaded: true
      }}));
    }});

    // Smooth native CSS scroll snap with zero JS jitter
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTime = 0;
    var isGestureLocked = false;

    slider.addEventListener('touchstart', function(e) {{
      if (e.touches.length === 1) {{
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }}
    }}, {{ passive: true }});

    slider.addEventListener('touchend', function(e) {{
      if (isGestureLocked || !e.changedTouches || e.changedTouches.length === 0) return;

      var touchEndX = e.changedTouches[0].clientX;
      var touchEndY = e.changedTouches[0].clientY;
      var deltaX = touchEndX - touchStartX;
      var deltaY = touchEndY - touchStartY;
      var duration = Date.now() - touchStartTime;

      var isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.25;
      var passedThreshold = Math.abs(deltaX) >= 48;

      if (isHorizontal && passedThreshold) {{
        isGestureLocked = true;
        setTimeout(function() {{ isGestureLocked = false; }}, 260);

        var width = window.innerWidth;
        if (deltaX < 0) {{
          // Finger moves Right to Left -> NEXT PAGE
          slider.scrollLeft += width;
        }} else {{
          // Finger moves Left to Right -> PREVIOUS PAGE
          slider.scrollLeft -= width;
        }}
      }} else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && duration < 300) {{
        var width = window.innerWidth;
        var clickX = touchEndX;
        if (clickX < width * 0.25) {{
          slider.scrollLeft -= width;
        }} else if (clickX > width * 0.75) {{
          slider.scrollLeft += width;
        }} else {{
          window.ReactNativeWebView.postMessage(JSON.stringify({{ type: 'TOGGLE_CONTROLS' }}));
        }}
      }}
    }}, {{ passive: true }});
  </script>
</body>
</html>"""

pipeline = ProcessingPipeline()
