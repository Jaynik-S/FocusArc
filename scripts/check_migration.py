"""Read-only schema assertions for the separate CI migration database."""
import os
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

engine = create_engine(os.environ['MIGRATION_DATABASE_URL'])
with engine.connect() as connection:
    head = ScriptDirectory.from_config(Config('alembic.ini')).get_current_head()
    assert connection.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == head
    inspector = inspect(connection)
    assert {'users', 'timers', 'sessions', 'day_summaries', 'alembic_version'} <= set(inspector.get_table_names())
    password_hash = next(c for c in inspector.get_columns('users') if c['name'] == 'password_hash')
    assert password_hash['nullable'] is True
    user_columns = {c['name']: c for c in inspector.get_columns('users')}
    assert user_columns['study_revision']['nullable'] is False
    assert user_columns['study_timezone']['nullable'] is False
    assert user_columns['study_last_seen_at']['nullable'] is True
    assert 'cycle_total_seconds' in {c['name'] for c in inspector.get_columns('timers')}
    reset_at = next(c for c in inspector.get_columns('timers') if c['name'] == 'cycle_reset_at')
    assert reset_at['nullable'] is True
    active = next(i for i in inspector.get_indexes('sessions') if i['name'] == 'ux_sessions_one_active_per_user')
    assert active['unique'] and 'end_at IS NULL' in str(active['dialect_options']['postgresql_where'])
    assert inspector.get_foreign_keys('sessions') and inspector.get_foreign_keys('timers')
engine.dispose()
print('Migration revision, nullable password hashes, tables, cycle totals, foreign keys and active-session uniqueness verified')
