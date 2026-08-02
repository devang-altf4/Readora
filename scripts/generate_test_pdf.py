import fitz  # PyMuPDF
import sys
from pathlib import Path

def create_sample_pdf(output_path: str = "sample_book.pdf"):
    doc = fitz.open()
    
    # Page 1
    page1 = doc.new_page()
    page1.insert_text((50, 80), "Dindle Sample E-Reader Book", fontsize=24)
    page1.insert_text((50, 120), "Author: Devang Gupta", fontsize=14)
    page1.insert_text((50, 160), "Chapter 1: The Beginning of Digital Vellum", fontsize=18)
    page1.insert_text((50, 200), "Dindle is a private personal e-reader application built for calm, distraction-free reading.", fontsize=12)
    page1.insert_text((50, 230), "It features warm off-white paper tones, reflowable text layout, and offline-first storage.", fontsize=12)

    # Page 2
    page2 = doc.new_page()
    page2.insert_text((50, 80), "Chapter 2: Smart Reading Technology", fontsize=18)
    page2.insert_text((50, 120), "Smart Reading Mode extracts text from PDF documents and renders reflowable HTML inside React Native WebView.", fontsize=12)
    page2.insert_text((50, 150), "Readers can adjust font family, font size, margins, and switch between Light, Sepia, and Dark themes.", fontsize=12)

    doc.save(output_path)
    print(f"Created sample PDF at {output_path}")

if __name__ == "__main__":
    create_sample_pdf()
