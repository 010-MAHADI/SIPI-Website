#!/usr/bin/env python3
"""
Script to check email templates and debug seller notification issues
"""

import os
import sys
import django

# Add the server directory to Python path
sys.path.append('server')

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from emails.models import EmailTemplate, EmailPreference, EmailLog
from django.contrib.auth import get_user_model
from orders.models import Order

User = get_user_model()

def check_email_templates():
    """Check if email templates are properly set up"""
    print("🔍 Checking Email Templates")
    print("=" * 50)
    
    templates = EmailTemplate.objects.all()
    if not templates.exists():
        print("❌ No email templates found!")
        print("   Run: python manage.py setup_email_templates")
        return False
    
    for template in templates:
        status = "✅ Active" if template.is_active else "❌ Inactive"
        print(f"{status} {template.template_type}: {template.subject}")
    
    # Check specifically for new_order_seller template
    try:
        seller_template = EmailTemplate.objects.get(template_type='new_order_seller')
        if seller_template.is_active:
            print(f"\n✅ Seller notification template is active")
        else:
            print(f"\n❌ Seller notification template is INACTIVE")
            return False
    except EmailTemplate.DoesNotExist:
        print(f"\n❌ Seller notification template NOT FOUND")
        return False
    
    return True

def check_seller_preferences():
    """Check seller email preferences"""
    print("\n🔍 Checking Seller Email Preferences")
    print("=" * 50)
    
    sellers = User.objects.filter(role='Seller')
    if not sellers.exists():
        print("❌ No sellers found in database")
        return False
    
    for seller in sellers:
        try:
            prefs = EmailPreference.objects.get(user=seller)
            status = "✅ Enabled" if prefs.new_order_alerts else "❌ Disabled"
            print(f"{status} {seller.email} - New order alerts: {prefs.new_order_alerts}")
        except EmailPreference.DoesNotExist:
            print(f"⚠️  {seller.email} - No preferences (defaults to enabled)")
    
    return True

def check_recent_orders():
    """Check recent orders and their email logs"""
    print("\n🔍 Checking Recent Orders and Email Logs")
    print("=" * 50)
    
    recent_orders = Order.objects.all().order_by('-created_at')[:5]
    if not recent_orders.exists():
        print("❌ No orders found")
        return False
    
    for order in recent_orders:
        print(f"\nOrder {order.order_id} ({order.created_at.strftime('%Y-%m-%d %H:%M')})")
        
        # Check email logs for this order
        email_logs = EmailLog.objects.filter(order=order)
        
        customer_confirmation = email_logs.filter(template_type='order_confirmation').first()
        seller_notifications = email_logs.filter(template_type='new_order_seller')
        
        if customer_confirmation:
            print(f"  ✅ Customer confirmation: {customer_confirmation.status}")
        else:
            print(f"  ❌ No customer confirmation found")
        
        if seller_notifications.exists():
            for log in seller_notifications:
                print(f"  ✅ Seller notification to {log.recipient_email}: {log.status}")
                if log.error_message:
                    print(f"     Error: {log.error_message}")
        else:
            print(f"  ❌ No seller notifications found")
            
            # Check if order has items with shops
            items_with_shops = order.items.filter(product__shop__isnull=False)
            if items_with_shops.exists():
                print(f"     Order has {items_with_shops.count()} items with shops")
                for item in items_with_shops:
                    seller = item.product.shop.seller
                    print(f"     - {item.product_title} from {seller.email}")
            else:
                print(f"     ❌ Order has no items with shops!")
    
    return True

def check_smtp_config():
    """Check SMTP configuration"""
    print("\n🔍 Checking SMTP Configuration")
    print("=" * 50)
    
    from django.conf import settings
    
    smtp_host = getattr(settings, 'SMTP_HOST', None)
    smtp_user = getattr(settings, 'SMTP_USER', None)
    smtp_pass = getattr(settings, 'SMTP_PASS', None)
    
    if smtp_host and smtp_user and smtp_pass:
        print(f"✅ SMTP Host: {smtp_host}")
        print(f"✅ SMTP User: {smtp_user}")
        print(f"✅ SMTP Pass: {'*' * len(smtp_pass) if smtp_pass else 'Not set'}")
    else:
        print(f"❌ SMTP configuration incomplete:")
        print(f"   Host: {smtp_host or 'Not set'}")
        print(f"   User: {smtp_user or 'Not set'}")
        print(f"   Pass: {'Set' if smtp_pass else 'Not set'}")
        return False
    
    return True

def main():
    print("🚀 Email System Diagnostic")
    print("=" * 50)
    
    checks = [
        check_smtp_config,
        check_email_templates,
        check_seller_preferences,
        check_recent_orders,
    ]
    
    results = []
    for check in checks:
        try:
            result = check()
            results.append(result)
        except Exception as e:
            print(f"❌ Error during check: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    if all(results):
        print("✅ All checks passed!")
    else:
        print("❌ Some checks failed. See details above.")
        print("\n💡 Common fixes:")
        print("1. Run: python manage.py setup_email_templates")
        print("2. Check SMTP credentials in .env file")
        print("3. Verify seller email preferences")
        print("4. Check if orders have products with shops")

if __name__ == "__main__":
    main()