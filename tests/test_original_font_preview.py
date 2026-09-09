"""The original on-site specimen is an explicit, source-free preview export."""
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont
import pytest

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / 'type' / 'preview'
EDITORIAL_COVERAGE = sorted(set(range(32, 127)) | {
    160, 176, 177, 215, 247, 8211, 8212, 8216, 8217, 8220, 8221, 8226, 8230, 8722,
})
MONO_LATIN_COVERAGE = [
    32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
    48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
    64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
    80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,
    96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
    110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
    123, 124, 125, 126, 160, 176, 177, 192, 193, 194, 195, 196, 197,
    199, 200, 201, 202, 203, 204, 205, 206, 207, 209, 210, 211, 212,
    213, 214, 215, 217, 218, 219, 220, 221, 224, 225, 226, 227, 228,
    229, 231, 232, 233, 234, 235, 236, 237, 238, 239, 241, 242, 243,
    244, 245, 246, 247, 249, 250, 251, 252, 253, 255, 305, 376, 768,
    769, 770, 771, 776, 778, 807, 8211, 8212, 8216, 8217, 8220, 8221,
    8226, 8230, 8722,
]
COMBINING_MARK_CODES = {768, 769, 770, 771, 776, 778, 807}
EXPECTED_PREVIEWS = {
    'editorial': {
        'family': 'Zentropy Editorial Preview',
        'coverage': EDITORIAL_COVERAGE,
        'glyph_count': 110,
    },
    'mono': {
        'family': 'Zentropy Mono Preview',
        'coverage': MONO_LATIN_COVERAGE,
        'glyph_count': 172,
    },
}


def assert_no_private_markers(text):
    lower = text.lower()
    for private in ('c:/', 'c:\\', '.scratch', '.ufo', 'masters/', 'recipes/', 'source_sha256'):
        assert private not in lower


def enabled_tags(font, table_name, script_tag):
    table = font[table_name].table
    script = next(record.Script for record in table.ScriptList.ScriptRecord if record.ScriptTag == script_tag)
    return {
        table.FeatureList.FeatureRecord[index].FeatureTag
        for index in script.DefaultLangSys.FeatureIndex
    }


def test_preview_export_has_only_reviewed_public_files():
    assert {path.name for path in PREVIEW.iterdir()} == {
        'editorial.json', 'zentropy-editorial-regular.woff2',
        'mono.json', 'zentropy-mono-regular.woff2',
    }


@pytest.mark.parametrize('slug', ['editorial', 'mono'])
def test_preview_metadata_matches_reviewed_public_contract(slug):
    expected = EXPECTED_PREVIEWS[slug]
    record = json.loads((PREVIEW / f'{slug}.json').read_text(encoding='utf-8'))
    assert set(record) == {
        'schema', 'id', 'family', 'style', 'status', 'saleEnabled',
        'technique', 'intendedUse', 'sourceRelationship', 'limitations',
        'coverage', 'coverageCount', 'glyphCount', 'file', 'sha256', 'bytes',
    }
    assert record['schema'] == 'zentropy.font-preview/v1'
    assert record['status'] == 'development-preview'
    assert record['saleEnabled'] is False
    assert record['style'] == 'Regular'
    assert record['family'] == expected['family']
    assert record['file'] == f'zentropy-{slug}-regular.woff2'
    data = (PREVIEW / record['file']).read_bytes()
    assert data[:4] == b'wOF2'
    assert len(data) == record['bytes'] < 16_384
    assert hashlib.sha256(data).hexdigest() == record['sha256']
    assert 'No retail license offered' in record['limitations']
    assert_no_private_markers(json.dumps(record))
    assert record['coverage'] == expected['coverage']
    assert record['coverageCount'] == len(record['coverage']) == len(expected['coverage'])
    assert record['glyphCount'] == expected['glyph_count']


@pytest.mark.parametrize('slug', ['editorial', 'mono'])
def test_preview_binary_matches_coverage_and_has_no_private_metadata(slug):
    expected = EXPECTED_PREVIEWS[slug]
    record = json.loads((PREVIEW / f'{slug}.json').read_text(encoding='utf-8'))
    with TTFont(PREVIEW / record['file']) as font:
        assert font.flavor == 'woff2'
        assert set(font.keys()) <= {
            'GlyphOrder', 'head', 'hhea', 'maxp', 'OS/2', 'hmtx', 'cmap',
            'loca', 'glyf', 'name', 'post', 'GDEF', 'GPOS', 'GSUB',
        }
        assert {name.nameID for name in font['name'].names} == {1, 2, 3, 4, 5, 6, 8, 9, 10, 13, 16, 17}
        assert font['name'].getDebugName(1) == record['family']
        for name in font['name'].names:
            decoded = name.toUnicode().lower()
            assert_no_private_markers(decoded)
            assert 'private' not in decoded
        assert sorted(font.getBestCmap()) == record['coverage'] == expected['coverage']
        assert font['maxp'].numGlyphs == record['glyphCount'] == expected['glyph_count']
        if slug == 'mono':
            assert font['post'].isFixedPitch == 1
            cmap = font.getBestCmap()
            for code in sorted(set(expected['coverage']) - COMBINING_MARK_CODES):
                assert font['hmtx'][cmap[code]][0] == 620, f'U+{code:04X}'
            for code in sorted(COMBINING_MARK_CODES):
                assert font['hmtx'][cmap[code]][0] == 0, f'U+{code:04X}'
            assert 'mark' in enabled_tags(font, 'GPOS', 'latn')
            assert 'ccmp' in enabled_tags(font, 'GSUB', 'latn')
