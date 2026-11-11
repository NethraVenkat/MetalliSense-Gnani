import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'app'))
from copilot.voice_auth import normalize_code

def test_cardinal_groups_preserve_private_sequence():
    cases=[('forty two one three zero five',[42,1,3,0,5]),('forty two fifty three sixty four',[42,53,64]),('oh one two three four five',[0,1,2,3,4,5]),('டபுள் ஒன்று இரண்டு மூன்று நான்கு ஐந்து',[1,1,2,3,4,5]),('डबल एक दो तीन चार पाँच',[1,1,2,3,4,5])]
    for text,parts in cases:
        assert bool(normalize_code(text)==''.join(map(str,parts)))
    assert normalize_code('unrecognized words') is None
