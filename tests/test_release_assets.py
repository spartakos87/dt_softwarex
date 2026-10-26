from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_synthetic_building_assets_present():
    for floor in (0, 1):
        path = ROOT / 'frontend/public' / f'floor_{floor}.glb'
        assert path.exists() and path.stat().st_size > 1000
        assert (ROOT / 'frontend/public' / f'floor_{floor}_captions.jpg').exists()


def test_no_original_database_backup_or_bootstrap_archive():
    assert not (ROOT / 'database/backup.sql').exists()
    assert not (ROOT / 'initialize.zip').exists()
    assert '.env' in (ROOT / '.gitignore').read_text()


def test_secure_configuration_is_used():
    text = (ROOT / 'backend/utils/security.py').read_text()
    assert 'JWT_SECRET' in text
    assert 'to_pio_mistiko_klidi' not in text
    assert 'admin123!' not in (ROOT / 'docker-compose.yml').read_text()
