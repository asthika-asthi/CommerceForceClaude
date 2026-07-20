def test_read_landing_sections_returns_all_sections(landing_config_fixture_path):
    from app.core.landing_config import read_landing_sections

    sections = read_landing_sections()
    assert len(sections) == 3
    assert sections[0]["__block"] == "landing-hero"


def test_get_editable_section_defs_filters_and_extracts(landing_config_fixture_path):
    from app.core.landing_config import get_editable_section_defs

    defs = get_editable_section_defs()
    keys = {d["section_key"] for d in defs}
    assert keys == {"trust-strip", "hero"}

    hero_def = next(d for d in defs if d["section_key"] == "hero")
    assert hero_def["editable_fields"] == ["title", "titleHighlight", "bgImageSrc", "missingField"]
    assert hero_def["section"]["title"] == "Original Title"

