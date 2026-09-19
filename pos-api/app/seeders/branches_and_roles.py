"""Seed branches and roles."""
import datetime
from app.database.config import (
    database, branches, roles
)

BRANCH = {
    "name": "MMG Albay Main",
    "tin": "000-000-000-000",
    "city": "Legazpi City",
    "state": "Albay",
    "postalCode": "4500",
    "contactNumber": "09000000000",
    "emailAddress": "mmgalbay@email.com",
    "streetAddress": "Rizal St., Legazpi City, Albay",
    "isActive": True,
    "created_by": None,
}

RESOURCES = [
    "/resource",
    "/branch/create",
    "/branch/edit",
    "/branch",
    "/branches",
    "/corporate",
    "/customer",
    "/doctor",
    "/package",
    "/product",
    "/product/category/create",
    "/product/category/edit",
    "/product/category",
    "/product/categories",
    "/user/register",
    "/user/edit",
    "/user",
    "/users",
    "/transaction/edit",
    "/transaction/create",
    "/transaction",
    "/transactions",
    "/sales-deposits",
    "/cashier-reports",
]

ADMIN_ROLE = {
    "name": "admin",
    "authorizations": [
        {"resource": r, "permissions": {"read": True, "create": True, "update": True, "delete": True}}
        for r in RESOURCES
    ],
}

CASHIER_RESOURCES = [
    "/transaction/create",
    "/transaction/edit",
    "/transaction",
    "/transactions",
    "/cashier-reports",
    "/customer",
    "/package",
    "/product",
    "/product/categories",
    "/doctor",
    "/branches",
    "/branch",
    "/discounts",
]

CASHIER_ROLE = {
    "name": "cashier",
    "authorizations": [
        {"resource": r, "permissions": {"read": True, "create": True, "update": True}}
        for r in CASHIER_RESOURCES
    ],
}


def seed(log_fn):
    """Seed branches and roles."""
    # Branch
    existing_branch = branches.find_one({"name": BRANCH["name"]})
    if existing_branch:
        branch_id = existing_branch["_id"]
        log_fn(f"Branch already exists — skipping ({branch_id})")
    else:
        result = branches.insert_one(BRANCH)
        branch_id = result.inserted_id
        log_fn(f"Created branch: {BRANCH['name']} ({branch_id})")

    # Admin role
    existing_admin_role = roles.find_one({"name": ADMIN_ROLE["name"]})
    if existing_admin_role:
        admin_role_id = existing_admin_role["_id"]
        log_fn(f"Role 'admin' already exists — skipping ({admin_role_id})")
    else:
        result = roles.insert_one(ADMIN_ROLE)
        admin_role_id = result.inserted_id
        log_fn(f"Created role: admin ({admin_role_id})")

    # Cashier role
    existing_cashier_role = roles.find_one({"name": CASHIER_ROLE["name"]})
    if existing_cashier_role:
        cashier_role_id = existing_cashier_role["_id"]
        log_fn(f"Role 'cashier' already exists — skipping ({cashier_role_id})")
    else:
        result = roles.insert_one(CASHIER_ROLE)
        cashier_role_id = result.inserted_id
        log_fn(f"Created role: cashier ({cashier_role_id})")

    return branch_id, admin_role_id, cashier_role_id
