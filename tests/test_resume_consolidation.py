"""Source parity and one-page constraints for the 2026-09-20 career release."""
from pathlib import Path
import json
import re
import subprocess
import sys
import fitz
from docx import Document

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / 'career/resume-source.json').read_text())


def words(text):
    return re.findall(r"[A-Za-z0-9]+", text.lower())


def test_generated_career_text_has_no_source_drift():
    result = subprocess.run([sys.executable, 'tools/render_career_pages.py', '--check'], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_all_submission_formats_share_reading_order_and_complete_content():
    for item in SOURCE['documents']:
        stem = ROOT / 'career' / item['stem']
        text = stem.with_suffix('.txt').read_text()
        pdf = fitz.open(stem.with_suffix('.pdf'))
        docx = Document(stem.with_suffix('.docx'))
        assert words(text) == words(' '.join(p.get_text() for p in pdf)), item['id']
        assert words(text) == words(' '.join(p.text for p in docx.paragraphs)), item['id']
        assert len(pdf) == (4 if item['id'] == 'page:cv' else 1)
        assert not docx.tables
        assert len(text.split()) >= 250
        assert '2023 to Present' in text
        assert 'April 25, 2015 to June 2, 2026' in text
        assert '2014 to 2015' in text
        assert 'Began 2017' in text
        for page in pdf:
            assert page.rect.width == 612 and page.rect.height == 792
            assert not page.get_images()
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    for span in line['spans']:
                        assert span['size'] >= 10.5
                        assert 20 <= span['bbox'][0] < span['bbox'][2] <= 592
                        assert 20 <= span['bbox'][1] < span['bbox'][3] <= 772


def test_evaluation_metrics_are_coverage_not_financial_or_performance_claims():
    text = (ROOT / 'career/Zain-Dana-Harper-Resume-Evaluation-Tooling-Python-Developer-Tools.txt').read_text()
    assert all(value in text for value in ('324', '337', '5,058'))
    assert not re.search(r'\$\s*\d|\d+\s*%|guaranteed|revenue generated', text, re.I)
    assert all(name in text for name in ('Flywheel', 'Articulate', 'Accountable Surface', 'BuildLang', 'Phantom'))
