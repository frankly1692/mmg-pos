"""Seed packages."""
import datetime
from app.database.config import packages as packages_collection, products as products_collection


# Lab test items referenced by name below must exist in app/seeders/products.py —
# a package's lab test array is denormalized (name/price copied at creation time).
# Stored as `lab_test` (snake_case) to match app/routes/packages/create.py, which is
# what the DB field is actually named — read.py maps it back to `labTest` on the way out.
PACKAGES = [
    {
        "name": "Basic Consultation",
        "description": "Standard medical consultation",
        "package_type": "package",
        "lab_tests": ["CBC w/ Platelet Count", "Urinalysis"],
    },
    {
        "name": "Full Medical Checkup",
        "description": "Comprehensive health screening",
        "package_type": "package",
        "lab_tests": ["CBC w/ Platelet Count", "Urinalysis", "Chest PA", "FBS/PPBS"],
    },
    {
        "name": "Emergency Package",
        "description": "Emergency medical services",
        "package_type": "package",
        "lab_tests": ["ECG WITH READER'S FEE", "CBC w/ Platelet Count"],
    },
]


def seed(log_fn):
    """Seed packages."""
    now = datetime.datetime.utcnow()

    for raw in PACKAGES:
        existing = packages_collection.find_one({"name": raw["name"]})

        if existing:
            log_fn(f"Package '{raw['name']}' already exists — skipping ({existing['_id']})")
            continue

        lab_test = []
        for lab_test_name in raw["lab_tests"]:
            product = products_collection.find_one({"name": lab_test_name})
            if not product:
                log_fn(f"  ! Lab test '{lab_test_name}' not found — skipping from '{raw['name']}'")
                continue
            lab_test.append({
                "_id": str(product["_id"]),
                "name": product["name"],
                "price": product["price"],
                "excludeFromDiscount": False,
            })

        total_price = sum(item["price"] for item in lab_test)

        doc = {
            "name": raw["name"],
            "description": raw["description"],
            "package_type": raw["package_type"],
            "lab_test": lab_test,
            "totalPackagePrice": total_price,
            "totalDiscountedPrice": total_price,
            "packageForMemberType": "all",
            "discount": None,
            "created_by": None,
            "created_at": now,
        }
        result = packages_collection.insert_one(doc)
        log_fn(f"Created package: {raw['name']} ({result.inserted_id})")
