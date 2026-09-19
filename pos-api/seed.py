"""
Master seeder — orchestrates all database initialization.
Runs all sub-seeders in order: branches, roles, users, discounts, categories, packages, products.
Idempotent: skips any record that already exists.

Usage (inside Docker):
    docker-compose exec server python seed.py

Usage (local dev):
    source .venv/Scripts/activate
    python seed.py
"""

import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient

# Import all seeders
from app.seeders import branches_and_roles, users, discounts, product_categories, packages, products, audit_logs_lookup

load_dotenv()

DATABASE_URL = os.getenv("LOCAL_DATABASE_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE", "pos")

client = MongoClient(DATABASE_URL)
db = client[DATABASE_NAME]


def log(msg: str):
    print(f"  {msg}")


def seed_all():
    """Run all seeders in order."""
    print("\nSeeding database...\n", flush=True)

    try:
        # 1. Branches and Roles (required by users)
        print("━━ Branches & Roles ━━", flush=True)
        branch_id, admin_role_id, cashier_role_id = branches_and_roles.seed(log)

        # 2. Users (depends on branch and role IDs)
        print("\n━━ Users ━━", flush=True)
        users.seed(log, branch_id, admin_role_id, cashier_role_id)

        # 3. Discounts
        print("\n━━ Discounts ━━", flush=True)
        discounts.seed(log)

        # 4. Product Categories
        print("\n━━ Product Categories ━━", flush=True)
        product_categories.seed(log)

        # 5. Packages
        print("\n━━ Packages ━━", flush=True)
        packages.seed(log)

        # 6. Products (depends on categories existing)
        print("\n━━ Products ━━", flush=True)
        products.seed(log)

        # 7. Audit log action display names
        print("\n━━ Audit Log Lookup ━━", flush=True)
        audit_logs_lookup.seed(log)

        print("\n✓ All seeding complete.\n", flush=True)
    except Exception as e:
        print(f"\n✗ Seeding failed at this step: {e}\n")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    try:
        seed_all()
    except Exception as e:
        print(f"\n✗ Seeding failed: {e}\n")
        sys.exit(1)
