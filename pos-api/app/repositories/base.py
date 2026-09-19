
import abc

from bson import ObjectId
from dotenv import load_dotenv
from pydantic import BaseModel
import pymongo
from app.config import IS_DEVELOPMENT, IS_INTERNAL_PRODUCTION, IS_PRODUCTION
from app.database.database import get_current_backup_database, get_current_database, remote_database, backup_database, internal_prod_database


# if IS_DEVELOPMENT:


class Repository(abc.ABC):
    _db = None
    _collection = None

    def __init__(self):
        current_database = get_current_database()
        self._db = current_database.connect()
    
    def find(self, query):
        try:
            data = list(self._db[self._collection].find(query))
            return data
        except:
            raise
        
    def find_one(self, query):
        try:
            data = self.find(query)
            return data[0] if data else None
        except:
            raise
        
    def insert_one(self, data):
        try:
            return self._db[self._collection].insert_one(data)
        except:
            raise
    
    def insert_many(self, data):
        try:
            return self._db[self._collection].insert_many(data)
        except:
            raise

    def delete_many(self, query):
        try:
            return self._db[self._collection].delete_many(query)
        except:
            raise
    
    def update_many(self, query, data:BaseModel, *args, **kwargs):
        data = data.model_dump(exclude_none=True)
        data = { '$set': data }
        return self._db[self._collection].update_many(query, data, *args, **kwargs, return_document=pymongo.ReturnDocument.AFTER)
    
    def update_many_bare(self, query, data, *args, **kwargs):
        data = { '$set': data }
        return self._db[self._collection].update_many(query, data, *args, **kwargs)
    
    def update_one(self, query, data: BaseModel, *args, **kwargs):
        try:
            data = data.model_dump(exclude_none=True)
            data = { '$set': data }
            return_document = self._db[self._collection].find_one_and_update(query, data, *args, **kwargs, return_document=pymongo.ReturnDocument.AFTER)
            return self.find_one({ '_id': ObjectId(return_document['_id']) })
        except:
            raise
    
    def update_one_bare(self, query, data, refetch: bool = True, *args, **kwargs):
        try:
            data = { '$set': data }
            return_document = self._db[self._collection].find_one_and_update(query, data, *args, **kwargs, return_document=pymongo.ReturnDocument.AFTER)
            if(return_document is None or not refetch):
                return None
            return self.find_one({ '_id': ObjectId(return_document['_id']) })
        except:
            raise
    
    def _get_next_sequence(self, data):
        counter = self._db['counters'].find_one_and_update(
            data,
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        return counter['seq']

class BackupRepository(Repository):
    _backup_db = None
    _db = None
    _collection = None
    _backup_db_client = None
    _db_client = None

    def __init__(self):
        current_database = get_current_database()
        current_backup_database = get_current_backup_database()

        self._db = current_database.connect()
        self._db_client = current_database._connection

        if(current_backup_database is not None):
            self._backup_db = current_backup_database.connect()
            self._backup_db_client = current_backup_database._connection

    def insert_one(self, data):
        result = self._db[self._collection].insert_one(data)
        self.backup_one(data)
        return result



    def backup_one(self, data):
        if(self._backup_db is not None and IS_INTERNAL_PRODUCTION):
            self._backup_db[self._collection].insert_one(data)