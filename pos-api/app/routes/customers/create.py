
import os
from datetime import datetime
from operator import itemgetter

import bcrypt
import jwt
from bson import ObjectId
from flask import Blueprint, g, request

from app.database.config import customers
from app.database.store import insert_one
from app.new_models.AuditLog import AuditCode, AuditLog
from app.repositories.audit_log import AuditLogRepository
from app.utils.utils import getLocalTime

create_customer = Blueprint("/customer/create", __name__)
logger = AuditLogRepository()


@create_customer.route('/customer/create', methods=['POST'])
def _create_customer():
   request_data = request.get_json()
   f_name = request_data['firstName']
   m_name = request_data.get('middleName')
   l_name = request_data['lastName']
   age = request_data['age']
   gender = request_data['gender']
   address = request_data['address']
   customer_type = request_data['customerType']
   customer_type_id = request_data.get('customerTypeId')
   contact_number = request_data['contactNumber']
   birthDate = request_data['birthDate']
   # discount = 0
   # discount_type = None
   tin_number = None

   created_by = g.user_id
   created_at = getLocalTime()
   
   # if 'discount' in request_data:
   #    discount = request_data['discount']
   # if 'discountType' in request_data:
   #    discount_type = request_data['discountType']
   if 'tinNumber' in request_data:
      tin_number = request_data['tinNumber']

   # try: 
   #     float(discount)
   # except:
   #      return {
   #          'message': 'data format is invalid',
   #          'code': 23
   #      }, 401

   doc = insert_one('customers', {
      "first_name": f_name,
      "middle_name": m_name,
      "last_name": l_name,
      "age": age,
      "gender": gender,
      "address": address,
      "customer_type": customer_type,
      "customer_type_id": customer_type_id,
      "child_name": request_data.get('childName'),
      "child_birth_date": request_data.get('childBirthDate'),
      "child_age": request_data.get('childAge'),
      # "discount": float(discount),
      # "discount_type": discount_type,
      "tin_number": tin_number,
      "contact_number": contact_number,
      "created_by": created_by,
      "created_at": created_at,
      "birthDate": birthDate
   })
   
   if doc.inserted_id:
      logger.insert_one(AuditLog(action=AuditCode.CUSTOMER_CREATE, userId=g.user_id, data=request_data))

      return {
         'message': 'Customer successfully created',
         'code': 15,
      }, 200
   else:
      return {
         'message': 'Unable to add customer.',
         'code': 30,
      }, 200


