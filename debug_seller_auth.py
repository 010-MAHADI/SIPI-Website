#!/usr/bin/env python3
"""
Debug script for seller authentication issues
"""
import os
import sys
import django
import requests
import json

# Add the server directory to Python path
sys.path.append('/var/www/SIPI-Website/server')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from users.models import SellerProfile

User = get_user_model()

def test_superuser_login():
    """Test if superuser can login via API"""
    print("=== DEBUGGING SELLER AUTHENTICATION ===\n")
    
    # Check if superuser exists
    superusers = User.objects.filter(is_superuser=True)
    print(f"Found {superusers.count()} superuser(s):")
    for user in superusers:
        print(f"  - Email: {user.email}")
        print(f"  - Username: {user.username}")
        print(f"  - Is Active: {user.is_active}")
        print(f"  - Role: {getattr(user, 'role', 'Not set')}")
        
        # Check if seller profile exists
        try:
            seller_profile = SellerProfile.objects.get(user=user)
            print(f"  - Seller Profile Status: {seller_profile.status}")
        except SellerProfile.DoesNotExist:
            print("  - No Seller Profile found")
        print()
    
    if not superusers.exists():
        print("❌ No superuser found! Create one first:")
        print("python manage.py createsuperuser")
        return
    
    # Test API endpoint
    superuser = superusers.first()
    print(f"Testing login for: {superuser.email}")
    
    # Test the auth endpoint
    api_url = "http://127.0.0.1:8000/api/auth/token/"
    
    # Get password from user input
    password = input(f"Enter password for {superuser.email}: ")
    
    try:
        response = requests.post(api_url, json={
            "email": superuser.email,
            "password": password
        }, headers={
            "Content-Type": "application/json"
        })
        
        print(f"\n=== API Response ===")
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Login successful!")
            print(f"Access Token: {data.get('access', 'Not found')[:50]}...")
            print(f"Refresh Token: {data.get('refresh', 'Not found')[:50]}...")
            
            # Test profile endpoint
            access_token = data.get('access')
            if access_token:
                profile_response = requests.get(
                    "http://127.0.0.1:8000/api/users/profile/",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                print(f"\n=== Profile Response ===")
                print(f"Status Code: {profile_response.status_code}")
                if profile_response.status_code == 200:
                    profile_data = profile_response.json()
                    print(f"✅ Profile fetch successful!")
                    print(f"User ID: {profile_data.get('id')}")
                    print(f"Email: {profile_data.get('email')}")
                    print(f"Role: {profile_data.get('role')}")
                    print(f"Is Superuser: {profile_data.get('is_superuser')}")
                else:
                    print(f"❌ Profile fetch failed: {profile_response.text}")
        else:
            print(f"❌ Login failed: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to Django server. Make sure it's running on port 8000")
    except Exception as e:
        print(f"❌ Error: {e}")

def check_cors_settings():
    """Check CORS configuration"""
    print("\n=== CORS CONFIGURATION ===")
    from django.conf import settings
    
    print(f"CORS_ALLOWED_ORIGINS: {getattr(settings, 'CORS_ALLOWED_ORIGINS', 'Not set')}")
    print(f"CORS_ALLOW_ALL_ORIGINS: {getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', 'Not set')}")
    print(f"CORS_ALLOW_CREDENTIALS: {getattr(settings, 'CORS_ALLOW_CREDENTIALS', 'Not set')}")

def check_auth_endpoints():
    """Check if auth endpoints are properly configured"""
    print("\n=== AUTH ENDPOINTS CHECK ===")
    
    try:
        from django.urls import reverse
        from django.test import Client
        
        client = Client()
        
        # Test if endpoints exist
        endpoints = [
            '/api/auth/token/',
            '/api/users/profile/',
        ]
        
        for endpoint in endpoints:
            try:
                response = client.get(endpoint)
                print(f"✅ {endpoint} - Status: {response.status_code}")
            except Exception as e:
                print(f"❌ {endpoint} - Error: {e}")
                
    except Exception as e:
        print(f"❌ Error checking endpoints: {e}")

if __name__ == "__main__":
    test_superuser_login()
    check_cors_settings()
    check_auth_endpoints()