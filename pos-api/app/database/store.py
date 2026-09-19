from app.config import IS_INTERNAL_PRODUCTION
from .config import database
from .database import backup_database


def insert_one(collection_name, *args):
    ret = database[collection_name].insert_one(*args)

    if IS_INTERNAL_PRODUCTION:
        try:
            backup_db = backup_database.connect()
            backup_db[collection_name].insert_one(*args)
        except Exception as e:
            print(f"Backup insert failed: {e}")
    return ret
