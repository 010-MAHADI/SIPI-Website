from django.db.models.signals import post_save
from django.dispatch import receiver
from orders.models import Order
from .models import PromotionRecipient, PromotionAnalytics
from django.utils import timezone


@receiver(post_save, sender=Order)
def track_promotion_revenue(sender, instance, created, **kwargs):
    """Track revenue generated from promotion campaigns"""
    customer = getattr(instance, "customer", None)
    if created and customer:
        # Find recent promotion recipients for this user
        recent_recipients = PromotionRecipient.objects.filter(
            user=customer,
            sent_at__gte=timezone.now() - timezone.timedelta(days=7),  # Within last 7 days
            email_clicked=True  # Only if they clicked the email
        )
        
        for recipient in recent_recipients:
            # Check if any of the ordered products were in the promotion
            order_products = {
                item.product_id for item in instance.items.all() if item.product_id
            }
            promotion_products = set(recipient.campaign.products.values_list('id', flat=True))
            
            if order_products.intersection(promotion_products):
                # This order is likely from the promotion
                today = timezone.now().date()
                analytics, created = PromotionAnalytics.objects.get_or_create(
                    campaign=recipient.campaign,
                    date=today
                )
                
                analytics.revenue_generated += instance.total_amount
                analytics.orders_generated += 1
                analytics.save()
                
                # Only attribute to the first matching promotion to avoid double counting
                break
