"""The original on-site specimen is an explicit, source-free preview export."""
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / 'type' / 'preview'


def test_preview_export_has_only_reviewed_public_files():
    assert {path.name for path in PREVIEW.iterdir()} == {
        'editorial.json', 'zentropy-editorial-regular.woff2'
    }
    record = json.loads((PREVIEW / 'editorial.json').read_text(encoding='utf-8'))
    assert set(record) == {
        'schema', 'id', 'family', 'style', 'status', 'saleEnabled',
        'technique', 'intendedUse', 'sourceRelationship', 'limitations',
        'coverage', 'coverageCount', 'glyphCount', 'file', 'sha256', 'bytes',
    }
    assert record['schema'] == 'zentropy.font-preview/v1'
    assert record['status'] == 'development-preview'
    assert record['saleEnabled'] is False
    assert record['style'] == 'Regular'
    assert record['family'] == 'Zentropy Editorial Preview'
    assert record['file'] == 'zentropy-editorial-regular.woff2'
    data = (PREVIEW / record['file']).read_bytes()
    assert data[:4] == b'wOF2'
    assert len(data) == record['bytes'] < 16_384
    assert hashlib.sha256(data).hexdigest() == record['sha256']
    assert record['coverage'] == sorted(set(range(32, 127)) | {
        160, 176, 177, 215, 247, 8211, 8212, 8216, 8217, 8220, 8221, 8226, 8230, 8722,
    })
    assert record['coverageCount'] == len(record['coverage']) == 109
    assert 'No retail license offered' in record['limitations']
    for private in ('C:/', 'C:\\', '.scratch', '.ufo', 'masters/', 'recipes/', 'source_sha256'):
        assert private not in json.dumps(record)


def test_preview_binary_matches_coverage_and_has_no_private_metadata():
    record = json.loads((PREVIEW / 'editorial.json').read_text(encoding='utf-8'))
    with TTFont(PREVIEW / record['file']) as font:
        assert font.flavor == 'woff2'
        assert set(font.keys()) <= {
            'GlyphOrder', 'head', 'hhea', 'maxp', 'OS/2', 'hmtx', 'cmap',
            'loca', 'glyf', 'name', 'post', 'GDEF', 'GPOS', 'GSUB',
        }
        assert sorted(font.getBestCmap()) == record['coverage']
        assert font['maxp'].numGlyphs == record['glyphCount']
        assert {name.nameID for name in font['name'].names} == {1, 2, 3, 4, 5, 6, 8, 9, 10, 13, 16, 17}
        assert font['name'].getDebugName(1) == record['family']
        for name in font['name'].names:
            decoded = name.toUnicode().lower()
            for marker in ('c:/', 'c:\\', '.scratch', '.ufo', 'masters/', 'recipes/', 'source_sha256', 'private'):
                assert marker not in decoded
