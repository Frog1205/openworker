from pathlib import Path

from coworker.secrets import state_dir


def test_creator_and_enterprise_state_directories_are_isolated(monkeypatch, tmp_path: Path):
    monkeypatch.delenv("COWORKER_STATE_DIR", raising=False)
    monkeypatch.setenv("APPDATA", str(tmp_path))

    monkeypatch.setenv("ATLAS_PRODUCT", "creator")
    creator = state_dir()
    monkeypatch.setenv("ATLAS_PRODUCT", "enterprise")
    enterprise = state_dir()

    assert creator.name == "com.atlas.creator"
    assert enterprise.name == "com.atlas.enterprise"
    assert creator != enterprise


def test_explicit_state_directory_has_priority(monkeypatch, tmp_path: Path):
    explicit = tmp_path / "deployment-state"
    monkeypatch.setenv("ATLAS_PRODUCT", "enterprise")
    monkeypatch.setenv("COWORKER_STATE_DIR", str(explicit))
    assert state_dir() == explicit
