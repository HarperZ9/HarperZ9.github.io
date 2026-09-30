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
        assert len(pdf) == (5 if item['id'] == 'page:cv' else 1)
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


def test_credentials_keep_issuer_type_and_completion_evidence_separate():
    """A course achievement must not turn into an earned professional certification."""
    credentials = SOURCE['credentials']
    applied = [c for c in credentials if c['kind'] == 'Applied Skills credential']
    courses = [c for c in credentials if c['kind'] == 'Course-completion certificate']
    advanced = [c for c in credentials if c['kind'].startswith('Advanced ') and c['provider'] == 'Microsoft Learn']
    assert len(applied) == 3
    assert {c['credential_id'] for c in applied} == {
        'ED8852810C3B3FBC', '3D93C65204CB43EE', '4117A3B4196233D2'
    }
    assert len(courses) == 17
    assert len(advanced) == 2
    assert len({c['id'] for c in credentials}) == len(credentials)
    ledger = json.loads((ROOT / 'career/source-ledger.json').read_text())
    by_id = {row['id']: row for row in ledger['sources']}
    cv = (ROOT / 'career/Zain-Dana-Harper-CV.txt').read_text()
    for credential in credentials:
        assert by_id[credential['id']]['url'] == credential['url']
        assert credential['url'].startswith('https://')
    for course in courses:
        assert f"{course['course_code']}: {course['title']}" in cv
    assert 'The SC-100 certification exam has not been taken.' in SOURCE['credential_policy']
    assert 'Advanced Microsoft Learn Coursework' in cv
    assert 'Completed coursework:' in cv and 'Research references:' in cv
    assert SOURCE['identity']['location'] == 'Kent, Washington'
    bluedot = next(c for c in credentials if c['id'] == 'bluedot-agi-strategy')
    assert bluedot['kind'] == 'Course completion'
    assert 'Owner-confirmed' in bluedot['completion_evidence']
    assert bluedot['url_role'] == 'Provider course description, not individual completion verification'
    assert 'score_percent' not in bluedot and 'credential_id' not in bluedot
    assert 'AGI Strategy | Course completed in 2026' in cv
    mcp = next(c for c in credentials if c['id'] == 'anthropic-mcp-advanced')
    assert mcp['kind'] == 'Advanced course-completion badge'
    assert mcp['score_percent'] == 100
    assert mcp['url'] == 'https://academy.claude.com/verify/4dd2c6b9f121940a0a43e78f83171867'
    assert 'Model Context Protocol: Advanced topics' in cv
    qualys = next(c for c in credentials if c['id'] == 'qualys-policy-audit')
    assert qualys['kind'] == 'Vendor certification'
    assert (qualys['earned'], qualys['expires']) == ('2026-09-30', '2028-09-29')
    assert qualys['assessment_result'] == '26 of 30 correct; passed on the first attempt'
    assert 'credential_id' not in qualys
    assert 'not individual credential verification' in qualys['url_role']
    car = next(c for c in credentials if c['id'] == 'qualys-car')
    assert car['kind'] == 'Vendor certification'
    assert (car['earned'], car['expires']) == ('2026-09-30', '2028-09-29')
    assert car['assessment_result'] == '29 of 30 correct; passed on the first attempt'
    assert 'credential_id' not in car
    assert 'not individual credential verification' in car['url_role']
    assert qualys['designation'] == car['designation'] == 'Qualys Certified Specialist'
    assert 'Qualys Certified Specialist: Policy Audit; Custom Assessment and Remediation' in cv
    assert 'Issued 2026-09-30; expire 2028-09-29' in cv
    assert 'Sole proprietor since September 2026' in cv
    assert 'Available for regular travel to San Francisco and London.' in cv


def test_public_interest_work_retains_its_evidence_limits():
    cv = (ROOT / 'career/Zain-Dana-Harper-CV.txt').read_text()
    assert all(title in cv for title in (
        'Who Knew First', 'Borrowed Ground', 'An Open Letter on Checking the Machines',
        'The Sandbox Was Never Just a Box', 'Witnessed Independence'))
    assert 'Independent essays on AI accountability' in cv
    assert 'Proposed contestable AI decisions' in cv
    assert 'Developed an AGI Strategy action plan for label-independent AI incident notice' in cv
    ledger = (ROOT / 'career/source-ledger.md').read_text()
    assert 'does not establish professional whistleblower-support' in ledger
    assert 'The proposed trial in An Open Letter on Checking the Machines has not run.' in ledger


def test_quantified_outcomes_keep_their_scope_and_reference_types():
    cv = (ROOT / 'career/Zain-Dana-Harper-CV.txt').read_text()
    assert '337 cases and 5,058 frozen expectations' in cv
    assert 'synthetic component-evaluation families' in cv
    assert 'count_odds interoperability check with three deterministic controls' in cv
    assert 'HTTP 500 or incorrect HTTP 200 to HTTP 400' in cv
    assert 'Six selected contributions merged across six external repositories' in cv
    references = (ROOT / 'career/standards-reference.md').read_text(encoding='utf-8')
    rows = [line for line in references.splitlines() if line.startswith('| [')]
    assert len(rows) == 25
    assert 'MCSB v2 remains preview' in references
    assert '1.2 remains an initial public draft' in references
    assert any('| Law |' in row for row in rows)
    assert any('| Framework or profile |' in row for row in rows)
    assert 'it is not a certificate' in references
    assert 'harperz9.github.io/career/standards-reference.md' in cv
    assert all(c['provider'] not in {'NIST', 'ISO', 'IEEE'} for c in SOURCE['credentials'])
