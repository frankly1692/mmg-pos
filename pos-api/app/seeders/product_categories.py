"""Seed product categories."""
import datetime
from bson import ObjectId
from app.database.config import product_categories as categories_collection


# These _id values must match the category_id fields hardcoded in
# app/seeders/products.py (extracted from the same backup) — the product
# read route looks categories up by _id, so these can't be arbitrary.
PRODUCT_CATEGORIES = [
    {"_id": "669fcde9cc94aac0b9ba75f1", "name": "Laboratory", "description": "Hematology, serology and chemistry lab tests", "isActive": True},
    {"_id": "669fcdf7cc94aac0b9ba75f2", "name": "ECG & Spirometry", "description": "Cardiopulmonary diagnostic tests", "isActive": True},
    {"_id": "669fce02cc94aac0b9ba75f3", "name": "Others", "description": "Miscellaneous and non-lab items", "isActive": True},
    {"_id": "669fce0fcc94aac0b9ba75f4", "name": "Drug Testing", "description": "Drug screening tests", "isActive": True},
    {"_id": "669fce20cc94aac0b9ba75f5", "name": "Professional Fee", "description": "Reading and professional fees", "isActive": True},
    {"_id": "669fce26cc94aac0b9ba75f6", "name": "Ultrasound", "description": "Ultrasound and sonography services", "isActive": True},
    {"_id": "669fce31cc94aac0b9ba75f7", "name": "X-Ray", "description": "Radiology and X-ray services", "isActive": True},
    {"_id": "669fcecdcc94aac0b9ba75f8", "name": "Special Chemistry", "description": "Hormone, tumor marker and send-out tests", "isActive": True},
]


def seed(log_fn):
    """Seed product categories."""
    now = datetime.datetime.utcnow()

    for raw in PRODUCT_CATEGORIES:
        category_id = ObjectId(raw["_id"])
        existing = categories_collection.find_one({"_id": category_id})

        if existing:
            log_fn(f"Product category '{raw['name']}' already exists — skipping ({existing['_id']})")
        else:
            doc = {
                "_id": category_id,
                "name": raw["name"],
                "description": raw["description"],
                "isActive": raw["isActive"],
                "created_by": None,
                "created_at": now,
            }
            result = categories_collection.insert_one(doc)
            log_fn(f"Created product category: {raw['name']} ({result.inserted_id})")
