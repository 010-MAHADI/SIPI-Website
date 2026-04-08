import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from django.conf import settings
from django.template import Template, Context
from django.utils import timezone
from typing import Dict, List, Optional, Any
from .models import EmailTemplate, EmailLog, EmailPreference

logger = logging.getLogger(__name__)

class EmailService:
    """Service class for handling email operations"""
    
    def __init__(self):
        self.smtp_host = getattr(settings, 'SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 465)
        self.smtp_secure = getattr(settings, 'SMTP_SECURE', True)
        self.smtp_user = getattr(settings, 'SMTP_USER', '')
        self.smtp_pass = getattr(settings, 'SMTP_PASS', '')
        
    def _get_smtp_connection(self):
        """Create and return SMTP connection"""
        try:
            if self.smtp_secure:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port)
                server.starttls()
            
            server.login(self.smtp_user, self.smtp_pass)
            return server
        except Exception as e:
            logger.error(f"Failed to create SMTP connection: {str(e)}")
            raise
    
    def _render_template(self, template_content: str, context: Dict[str, Any]) -> str:
        """Render template with context data"""
        template = Template(template_content)
        return template.render(Context(context))
    
    def _log_email(self, recipient_email: str, template_type: str, subject: str, 
                   status: str = 'pending', error_message: str = None, 
                   recipient_user=None, order=None, product=None) -> EmailLog:
        """Log email sending attempt"""
        return EmailLog.objects.create(
            recipient_email=recipient_email,
            recipient_user=recipient_user,
            template_type=template_type,
            subject=subject,
            status=status,
            error_message=error_message,
            order=order,
            product=product
        )
    
    def send_email(self, recipient_email: str, subject: str, html_content: str, 
                   text_content: str = None, template_type: str = 'custom',
                   recipient_user=None, order=None, product=None) -> bool:
        """Send email using SMTP"""
        
        # Create email log entry
        email_log = self._log_email(
            recipient_email=recipient_email,
            template_type=template_type,
            subject=subject,
            recipient_user=recipient_user,
            order=order,
            product=product
        )
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            
            # Set sender with display name
            site_name = getattr(settings, 'SITE_NAME', 'Flypick')
            sender_name = getattr(settings, 'EMAIL_SENDER_NAME', site_name)
            msg['From'] = f"{sender_name} <{self.smtp_user}>"
            msg['To'] = recipient_email
            msg['Subject'] = subject
            
            # Add text content if provided
            if text_content:
                text_part = MIMEText(text_content, 'plain', 'utf-8')
                msg.attach(text_part)
            
            # Add HTML content
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Send email
            with self._get_smtp_connection() as server:
                server.send_message(msg)
            
            # Update log status
            email_log.status = 'sent'
            email_log.save()
            
            logger.info(f"Email sent successfully to {recipient_email}")
            return True
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send email to {recipient_email}: {error_msg}")
            
            # Update log with error
            email_log.status = 'failed'
            email_log.error_message = error_msg
            email_log.save()
            
            return False
    
    def send_template_email(self, template_type: str, recipient_email: str, 
                           context: Dict[str, Any], recipient_user=None, 
                           order=None, product=None) -> bool:
        """Send email using predefined template"""
        
        try:
            # Get template
            template = EmailTemplate.objects.get(
                template_type=template_type, 
                is_active=True
            )
            
            # Render template with context
            subject = self._render_template(template.subject, context)
            html_content = self._render_template(template.html_content, context)
            text_content = None
            if template.text_content:
                text_content = self._render_template(template.text_content, context)
            
            # Send email
            return self.send_email(
                recipient_email=recipient_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                template_type=template_type,
                recipient_user=recipient_user,
                order=order,
                product=product
            )
            
        except EmailTemplate.DoesNotExist:
            logger.error(f"Email template '{template_type}' not found")
            return False
        except Exception as e:
            logger.error(f"Failed to send template email: {str(e)}")
            return False
    
    def check_user_preferences(self, user, notification_type: str) -> bool:
        """Check if user wants to receive specific type of notification"""
        try:
            preferences = EmailPreference.objects.get(user=user)
            
            preference_mapping = {
                'welcome': preferences.welcome_emails,
                'order_confirmation': preferences.order_confirmations,
                'order_status_update': preferences.order_updates,
                'promotional': preferences.promotional_emails,
                'new_order_seller': preferences.new_order_alerts,
                'stock_alert': preferences.stock_alerts,
            }
            
            return preference_mapping.get(notification_type, True)
            
        except EmailPreference.DoesNotExist:
            # If no preferences set, default to True
            return True


class NotificationService:
    """Service for handling different types of notifications"""
    
    def __init__(self):
        self.email_service = EmailService()
    
    def send_welcome_email(self, user) -> bool:
        """Send welcome email to new user"""
        if not self.email_service.check_user_preferences(user, 'welcome'):
            return False
        
        context = {
            'user_name': user.first_name or user.username,
            'user_email': user.email,
            'login_url': f"{getattr(settings, 'FRONTEND_URL', 'http://54.169.101.239')}/login",
            'site_name': getattr(settings, 'SITE_NAME', 'Flypick / Boibazar'),
            'current_year': timezone.now().year,
        }
        
        return self.email_service.send_template_email(
            template_type='welcome',
            recipient_email=user.email,
            context=context,
            recipient_user=user
        )
    
    @staticmethod
    def send_promotion_email(to_email: str, subject: str, context: dict) -> bool:
        """Static method to send promotion email"""
        notification_service = NotificationService()
        return notification_service._send_promotion_email_internal(to_email, subject, context)
    
    def _send_promotion_email_internal(self, to_email: str, subject: str, context: dict) -> bool:
        """Internal method to send promotion email"""
        try:
            from django.template.loader import render_to_string
            
            # Add frontend URL to context
            context['frontend_url'] = getattr(settings, 'FRONTEND_URL', 'http://localhost:8080')
            
            # Render the promotion email template
            html_content = render_to_string('email_templates/promotion.html', context)
            
            # Send email
            return self.email_service.send_email(
                recipient_email=to_email,
                subject=subject,
                html_content=html_content,
                template_type='promotion',
                recipient_user=context.get('user')
            )
            
        except Exception as e:
            logger.error(f"Failed to send promotion email: {str(e)}")
            return False
    
    def send_order_confirmation(self, order) -> bool:
        """Send order confirmation email"""
        if not self.email_service.check_user_preferences(order.customer, 'order_confirmation'):
            return False
        
        # Calculate order items details
        items_details = []
        for item in order.items.all():
            items_details.append({
                'name': item.product_title,
                'quantity': item.quantity,
                'price': item.price,
                'total': item.total_price,
                'image': item.product_image,
            })
        
        context = {
            'user_name': order.customer.first_name or order.customer.username,
            'order_id': order.order_id,
            'order_date': order.created_at.strftime('%B %d, %Y'),
            'items': items_details,
            'subtotal': order.subtotal,
            'shipping_cost': order.shipping_cost,
            'discount': order.discount,
            'total_amount': order.total_amount,
            'shipping_address': {
                'name': order.shipping_full_name,
                'phone': order.shipping_phone,
                'address': f"{order.shipping_street}, {order.shipping_city}, {order.shipping_state} {order.shipping_zip_code}",
                'country': order.shipping_country,
            },
            'payment_method': order.payment_method,
            'estimated_delivery': '3-5 business days',
            'tracking_url': f"{getattr(settings, 'FRONTEND_URL', 'http://54.169.101.239')}/orders/{order.order_id}",
            'site_name': getattr(settings, 'SITE_NAME', 'Flypick / Boibazar'),
            'current_year': timezone.now().year,
        }
        
        return self.email_service.send_template_email(
            template_type='order_confirmation',
            recipient_email=order.customer.email,
            context=context,
            recipient_user=order.customer,
            order=order
        )
    
    def send_order_status_update(self, order, old_status: str = None) -> bool:
        """Send order status update email"""
        if not self.email_service.check_user_preferences(order.customer, 'order_status_update'):
            return False
        
        status_messages = {
            'pending': 'Your order has been received and is being processed.',
            'processing': 'Your order is currently being prepared for shipment.',
            'shipped': 'Your order has been shipped and is on its way to you.',
            'delivered': 'Your order has been successfully delivered.',
            'cancelled': 'Your order has been cancelled.',
            'refunded': 'Your order has been refunded.',
        }
        
        context = {
            'user_name': order.customer.first_name or order.customer.username,
            'order_id': order.order_id,
            'old_status': old_status.title() if old_status else '',
            'new_status': order.status.title(),
            'status_message': status_messages.get(order.status, 'Your order status has been updated.'),
            'order_date': order.created_at.strftime('%B %d, %Y'),
            'tracking_url': f"{getattr(settings, 'FRONTEND_URL', 'http://54.169.101.239')}/orders/{order.order_id}",
            'site_name': getattr(settings, 'SITE_NAME', 'Flypick / Boibazar'),
            'current_year': timezone.now().year,
        }
        
        return self.email_service.send_template_email(
            template_type='order_status_update',
            recipient_email=order.customer.email,
            context=context,
            recipient_user=order.customer,
            order=order
        )
    
    def send_new_order_notification_to_seller(self, order) -> bool:
        """Send new order notification to seller"""
        # Get all sellers involved in this order
        sellers = set()
        for item in order.items.all():
            if item.product and item.product.shop:
                sellers.add(item.product.shop.seller)
        
        success_count = 0
        for seller in sellers:
            if not self.email_service.check_user_preferences(seller, 'new_order_seller'):
                continue
            
            # Get items for this seller
            seller_items = []
            for item in order.items.all():
                if item.product and item.product.shop and item.product.shop.seller == seller:
                    seller_items.append({
                        'name': item.product_title,
                        'quantity': item.quantity,
                        'price': item.price,
                        'total': item.total_price,
                    })
            
            context = {
                'seller_name': seller.first_name or seller.username,
                'order_id': order.order_id,
                'order_date': order.created_at.strftime('%B %d, %Y'),
                'customer_name': order.customer.first_name or order.customer.username,
                'customer_email': order.customer.email,
                'items': seller_items,
                'shipping_address': {
                    'name': order.shipping_full_name,
                    'phone': order.shipping_phone,
                    'address': f"{order.shipping_street}, {order.shipping_city}, {order.shipping_state} {order.shipping_zip_code}",
                    'country': order.shipping_country,
                },
                'payment_method': order.payment_method,
                'dashboard_url': f"{getattr(settings, 'SELLER_FRONTEND_URL', 'http://54.169.101.239:8080')}/orders",
                'site_name': getattr(settings, 'SITE_NAME', 'Flypick / Boibazar'),
                'current_year': timezone.now().year,
            }
            
            if self.email_service.send_template_email(
                template_type='new_order_seller',
                recipient_email=seller.email,
                context=context,
                recipient_user=seller,
                order=order
            ):
                success_count += 1
        
        return success_count > 0
    
    def send_stock_alert(self, product, alert_type: str = 'out_of_stock') -> bool:
        """Send stock alert to seller"""
        seller = product.shop.seller
        
        if not self.email_service.check_user_preferences(seller, 'stock_alert'):
            return False
        
        # Get low stock threshold
        try:
            preferences = EmailPreference.objects.get(user=seller)
            threshold = preferences.low_stock_threshold
        except EmailPreference.DoesNotExist:
            threshold = 5
        
        template_type = 'out_of_stock_alert' if alert_type == 'out_of_stock' else 'low_stock_alert'
        
        context = {
            'seller_name': seller.first_name or seller.username,
            'product_name': product.title,
            'product_sku': product.sku,
            'current_stock': product.stock,
            'threshold': threshold,
            'product_url': f"{getattr(settings, 'SELLER_FRONTEND_URL', 'http://54.169.101.239:8080')}/products/{product.id}",
            'dashboard_url': f"{getattr(settings, 'SELLER_FRONTEND_URL', 'http://54.169.101.239:8080')}/products",
            'site_name': getattr(settings, 'SITE_NAME', 'Flypick / Boibazar'),
            'current_year': timezone.now().year,
        }
        
        return self.email_service.send_template_email(
            template_type=template_type,
            recipient_email=seller.email,
            context=context,
            recipient_user=seller,
            product=product
        )