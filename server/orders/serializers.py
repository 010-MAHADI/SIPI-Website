from rest_framework import serializers
from django.utils import timezone
from .models import Order, OrderItem, PaymentMethod, ReturnRequest, ReturnItem
from products.serializers import ProductSerializer
from decimal import Decimal

class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id', 'cash_on_delivery', 'bkash', 'nagad', 'credit_card', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class OrderItemSerializer(serializers.ModelSerializer):
    product_details = serializers.SerializerMethodField()
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    product_image_url = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_title', 'product_image', 'product_image_url', 'color', 'size', 'quantity', 'price', 'total_price', 'product_details']
        read_only_fields = ['id', 'total_price']
    
    def get_product_details(self, obj):
        if not obj.product:
            return None

        try:
            return ProductSerializer(obj.product, context=self.context).data
        except Exception:
            # Keep orders list/detail usable even if current product metadata is malformed.
            return {
                'id': obj.product_id,
                'title': obj.product_title,
                'image_url': self.get_product_image_url(obj),
            }

    def get_product_image_url(self, obj):
        """Return full URL for the product image"""
        if obj.product and obj.product.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.product.image.url)
            return obj.product.image.url
        elif obj.product_image:
            # If product is deleted but we have the image path
            request = self.context.get('request')
            if request:
                from django.conf import settings
                return request.build_absolute_uri(settings.MEDIA_URL + obj.product_image)
            return obj.product_image
        return None


class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    color = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    size = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_name = serializers.CharField(source='customer.username', read_only=True)
    subtotal = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'order_id', 'customer', 'customer_email', 'customer_name',
            'shipping_full_name', 'shipping_phone', 'shipping_street', 'shipping_city',
            'shipping_state', 'shipping_zip_code', 'shipping_country',
            'payment_method', 'payment_status',
            'subtotal', 'shipping_cost', 'discount', 'coupon_code', 'total_amount',
            'status', 'created_at', 'updated_at', 'items'
        ]
        read_only_fields = ['id', 'order_id', 'customer', 'created_at', 'updated_at']

    def _request_user(self):
        request = self.context.get('request')
        return getattr(request, 'user', None)

    def _requested_shop_id(self):
        request = self.context.get('request')
        if not request:
            return None
        return request.query_params.get('shop')

    def _is_seller_request(self):
        user = self._request_user()
        return bool(
            user
            and user.is_authenticated
            and getattr(user, 'role', '') == 'Seller'
        )

    def _is_scoped_request(self):
        return bool(self._requested_shop_id() or self._is_seller_request())

    def _get_visible_items(self, obj):
        items = list(obj.items.all())
        requested_shop_id = self._requested_shop_id()
        if requested_shop_id:
            items = [
                item for item in items
                if item.product and str(item.product.shop_id) == str(requested_shop_id)
            ]
        elif self._is_seller_request():
            user = self._request_user()
            items = [
                item for item in items
                if item.product and item.product.shop and item.product.shop.seller_id == user.id
            ]
        return items

    def get_items(self, obj):
        queryset = self._get_visible_items(obj)
        return OrderItemSerializer(queryset, many=True, context=self.context).data

    def _get_seller_items_total(self, obj):
        total = Decimal('0')
        for item in self._get_visible_items(obj):
            total += item.price * item.quantity
        return total

    def get_subtotal(self, obj):
        if self._is_scoped_request():
            return self._get_seller_items_total(obj)
        return obj.subtotal

    def get_total_amount(self, obj):
        if self._is_scoped_request():
            # For shop/seller scoped views, only include the visible item totals.
            return self._get_seller_items_total(obj)
        return obj.total_amount


class OrderCreateSerializer(serializers.Serializer):
    # Shipping address
    shipping_full_name = serializers.CharField(max_length=200)
    shipping_phone = serializers.CharField(max_length=20)
    shipping_street = serializers.CharField()
    shipping_city = serializers.CharField(max_length=100)
    shipping_state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    shipping_zip_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    shipping_country = serializers.CharField(max_length=100, default='Bangladesh')
    
    # Payment
    payment_method = serializers.CharField(max_length=50)
    
    # Items
    items = OrderItemCreateSerializer(many=True)
    
    # Optional
    coupon_code = serializers.CharField(max_length=50, required=False, allow_blank=True)

    def _get_checkout_payment_config(self):
        from django.db.models import Q
        from seller.models import PaymentMethodSetting

        # Prefer admin/global payment settings for customer checkout.
        admin_config = (
            PaymentMethodSetting.objects
            .filter(Q(seller__role='Admin') | Q(seller__is_superuser=True))
            .order_by('-updated_at', '-id')
            .first()
        )
        if admin_config:
            return admin_config

        # Fallback to the most recently updated seller setting.
        seller_config = PaymentMethodSetting.objects.order_by('-updated_at', '-id').first()
        if seller_config:
            return seller_config

        # Legacy fallback for older deployments using orders.PaymentMethod.
        return PaymentMethod.objects.filter(shop__isnull=True).order_by('-updated_at', '-id').first()
    
    def validate_payment_method(self, value):
        """Validate that the payment method is enabled"""
        payment_config = self._get_checkout_payment_config()
        if not payment_config:
            # If no config exists, all methods are enabled by default.
            return value

        normalized_value = value.lower().strip()
        method_map = {
            'cod': payment_config.cash_on_delivery,
            'cash_on_delivery': payment_config.cash_on_delivery,
            'bkash': payment_config.bkash,
            'nagad': payment_config.nagad,
            'card': payment_config.credit_card,
            'credit_card': payment_config.credit_card,
        }

        if normalized_value in method_map and not method_map[normalized_value]:
            raise serializers.ValidationError(f"Payment method '{value}' is currently not available.")

        return value
    
    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Order must contain at least one item.")
        return value
    
    def create(self, validated_data):
        from products.models import Product
        from seller.models import Coupon
        from decimal import Decimal
        import uuid
        import logging
        
        logger = logging.getLogger(__name__)
        
        try:
            items_data = validated_data.pop('items')
            customer = self.context['request'].user
            
            # Generate unique order ID
            order_id = f"FP{uuid.uuid4().hex[:10].upper()}"
            
            # Calculate totals (use Decimal for all monetary values)
            subtotal = Decimal('0')
            shipping_cost = Decimal('0')
            order_items = []
            
            for item_data in items_data:
                try:
                    product = Product.objects.get(id=item_data['product_id'])
                except Product.DoesNotExist:
                    raise serializers.ValidationError(f"Product with ID {item_data['product_id']} not found.")
                
                price = Decimal(str(product.price))
                quantity = item_data['quantity']
                subtotal += price * quantity
                
                # Calculate shipping for this product
                if not product.freeShipping:
                    # Get shipping options from variants
                    variants = product.variants or {}
                    shipping_options = variants.get('shippingOptions', [])
                    
                    if shipping_options:
                        # Find first enabled shipping option
                        enabled_option = next((opt for opt in shipping_options if opt.get('enabled')), None)
                        if enabled_option:
                            item_shipping = Decimal(str(enabled_option.get('price', 0)))
                            shipping_cost += item_shipping * quantity
                
                order_items.append({
                    'product': product,
                    'product_title': product.title,
                    'product_image': product.image.name if product.image else '',
                    'color': item_data.get('color', ''),
                    'size': item_data.get('size', ''),
                    'quantity': quantity,
                    'price': price,
                })
            
            # Apply coupon if provided
            discount = Decimal('0')
            coupon_code = validated_data.get('coupon_code', '').strip().upper()
            if coupon_code:
                try:
                    # Find valid coupon
                    coupon = Coupon.objects.get(
                        code=coupon_code,
                        is_active=True,
                        expires_at__gte=timezone.now().date()
                    )
                    
                    # Check if coupon has uses left
                    if coupon.uses >= coupon.max_uses:
                        pass  # Coupon used up, no discount
                    elif subtotal < coupon.min_order_amount:
                        pass  # Order doesn't meet minimum amount
                    else:
                        # Check coupon type eligibility
                        is_eligible = False
                        
                        if coupon.coupon_type == 'all_products':
                            is_eligible = True
                        elif coupon.coupon_type == 'first_order':
                            # Check if this is customer's first order
                            previous_orders = Order.objects.filter(customer=customer).count()
                            is_eligible = previous_orders == 0
                        elif coupon.coupon_type == 'category':
                            # Check if any product in order belongs to coupon category
                            if coupon.category:
                                for item_data in order_items:
                                    product = item_data['product']
                                    # Check both category_fk (preferred) and category string
                                    try:
                                        if (product.category_fk == coupon.category or 
                                            (product.category and hasattr(coupon.category, 'name') and 
                                             product.category.lower() == coupon.category.name.lower())):
                                            is_eligible = True
                                            break
                                    except (AttributeError, TypeError) as e:
                                        logger.warning(f"Category comparison error for coupon {coupon_code}: {e}")
                                        continue
                        elif coupon.coupon_type == 'specific_products':
                            # Check if any product in order is in coupon's specific products
                            try:
                                coupon_product_ids = set(coupon.coupon_products.values_list('product_id', flat=True))
                                order_product_ids = set(item_data['product'].id for item_data in order_items)
                                is_eligible = bool(coupon_product_ids.intersection(order_product_ids))
                            except Exception as e:
                                logger.warning(f"Specific products coupon check error for {coupon_code}: {e}")
                                is_eligible = False
                        
                        if is_eligible:
                            if coupon.discount_type == 'percent':
                                discount = (subtotal * coupon.discount_value / Decimal('100')).quantize(Decimal('0.01'))
                            elif coupon.discount_type == 'fixed':
                                discount = min(coupon.discount_value, subtotal)  # Don't exceed order total
                            elif coupon.discount_type == 'shipping':
                                discount = shipping_cost
                            
                            # Update coupon usage
                            coupon.uses += 1
                            coupon.save(update_fields=['uses'])
                            
                except Coupon.DoesNotExist:
                    pass  # Invalid coupon code, no discount
                except Exception as e:
                    logger.error(f"Coupon processing error for {coupon_code}: {e}")
                    # Continue without coupon discount rather than failing the order
                    pass
            
            total_amount = max(Decimal('0'), subtotal + shipping_cost - discount)
            
            # Create order
            order = Order.objects.create(
                customer=customer,
                order_id=order_id,
                shipping_full_name=validated_data['shipping_full_name'],
                shipping_phone=validated_data['shipping_phone'],
                shipping_street=validated_data['shipping_street'],
                shipping_city=validated_data['shipping_city'],
                shipping_state=validated_data.get('shipping_state', ''),
                shipping_zip_code=validated_data.get('shipping_zip_code', ''),
                shipping_country=validated_data.get('shipping_country', 'Bangladesh'),
                payment_method=validated_data['payment_method'],
                payment_status='pending',
                subtotal=subtotal,
                shipping_cost=shipping_cost,
                discount=discount,
                coupon_code=coupon_code if discount > 0 else None,
                total_amount=total_amount,
                status='pending',
            )
            
            # Create order items and update product sold_count
            for item_data in order_items:
                OrderItem.objects.create(order=order, **item_data)
                
                # Update product sold_count
                try:
                    product = item_data['product']
                    product.sold_count += item_data['quantity']
                    product.save(update_fields=['sold_count'])
                except Exception as e:
                    logger.warning(f"Failed to update sold_count for product {product.id}: {e}")
                    # Continue without updating sold_count rather than failing the order
            
            return order
            
        except Exception as e:
            logger.error(f"Order creation failed: {e}")
            raise


class ReturnItemSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='order_item.product_title', read_only=True)
    product_image = serializers.CharField(source='order_item.product_image', read_only=True)
    
    class Meta:
        model = ReturnItem
        fields = ['id', 'order_item', 'product_title', 'product_image', 'quantity', 'reason']
        read_only_fields = ['id', 'product_title', 'product_image']


class ReturnRequestSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True, read_only=True)
    order_id = serializers.CharField(source='order.order_id', read_only=True)
    
    class Meta:
        model = ReturnRequest
        fields = [
            'id', 'return_id', 'order', 'order_id', 'reason', 'description',
            'status', 'refund_amount', 'admin_note', 'items',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'return_id', 'created_at', 'updated_at']


class ReturnRequestCreateSerializer(serializers.Serializer):
    order_id = serializers.CharField()
    reason = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    items = serializers.ListField(
        child=serializers.DictField(child=serializers.IntegerField())
    )
    
    def validate_order_id(self, value):
        try:
            order = Order.objects.get(order_id=value)
            if order.customer != self.context['request'].user:
                raise serializers.ValidationError("You can only request returns for your own orders.")
            if order.status != 'delivered':
                raise serializers.ValidationError("Returns can only be requested for delivered orders.")
            
            # Check if there's already a pending or approved return request for this order
            existing_returns = ReturnRequest.objects.filter(
                order=order,
                status__in=['pending', 'approved']
            )
            if existing_returns.exists():
                raise serializers.ValidationError(
                    "A return request for this order is already pending or approved. "
                    "Please wait for it to be processed before submitting another request."
                )
            
            return value
        except Order.DoesNotExist:
            raise serializers.ValidationError("Order not found.")
    
    def validate(self, data):
        """Validate that items haven't been returned already"""
        from .models import ReturnRequest, ReturnItem
        
        order = Order.objects.get(order_id=data['order_id'])
        items_data = data.get('items', [])
        
        # Get all existing return items for this order (excluding rejected returns)
        existing_return_items = ReturnItem.objects.filter(
            return_request__order=order,
            return_request__status__in=['pending', 'approved', 'refunded']
        ).select_related('order_item')
        
        # Create a map of order_item_id -> total returned quantity
        returned_quantities = {}
        for return_item in existing_return_items:
            order_item_id = return_item.order_item.id
            returned_quantities[order_item_id] = returned_quantities.get(order_item_id, 0) + return_item.quantity
        
        # Check if any requested items exceed available quantity
        errors = []
        for item_data in items_data:
            order_item_id = item_data['order_item_id']
            requested_qty = item_data['quantity']
            
            try:
                order_item = OrderItem.objects.get(id=order_item_id, order=order)
            except OrderItem.DoesNotExist:
                raise serializers.ValidationError(f"Order item {order_item_id} not found in this order.")
            
            already_returned = returned_quantities.get(order_item_id, 0)
            available_qty = order_item.quantity - already_returned
            
            if requested_qty > available_qty:
                if available_qty == 0:
                    errors.append(
                        f"{order_item.product_title}: This item has already been fully returned."
                    )
                else:
                    errors.append(
                        f"{order_item.product_title}: Only {available_qty} item(s) available for return "
                        f"({already_returned} already returned)."
                    )
        
        if errors:
            raise serializers.ValidationError({
                'items': errors
            })
        
        return data
    
    def create(self, validated_data):
        import uuid
        from .models import ReturnRequest, ReturnItem
        
        order = Order.objects.get(order_id=validated_data['order_id'])
        items_data = validated_data.pop('items')
        
        # Generate unique return ID
        return_id = f"RET{uuid.uuid4().hex[:10].upper()}"
        
        # Create return request
        return_request = ReturnRequest.objects.create(
            order=order,
            return_id=return_id,
            reason=validated_data['reason'],
            description=validated_data.get('description', ''),
            status='pending'
        )
        
        # Create return items
        for item_data in items_data:
            order_item = OrderItem.objects.get(id=item_data['order_item_id'])
            ReturnItem.objects.create(
                return_request=return_request,
                order_item=order_item,
                quantity=item_data['quantity']
            )
        
        return return_request
