from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from orders.models import Order, OrderItem
from products.models import Product
from users.roles import is_admin_user
from reviews.models import Review  # Import from reviews app instead

from .models import Category, Coupon, PaymentMethodSetting
from .serializers import (
    CategorySerializer,
    CouponSerializer,
    PaymentMethodSettingSerializer,
    SellerProductPreviewSerializer,
)

User = get_user_model()


class IsSellerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (is_admin_user(user) or getattr(user, "role", "") == "Seller")
        )


class SellerScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSellerOrAdmin]

    def get_seller(self):
        user = self.request.user
        if is_admin_user(user):
            seller_id = self.request.query_params.get("seller_id")
            if seller_id:
                try:
                    return User.objects.get(id=seller_id)
                except User.DoesNotExist:
                    return user
            return user
        return user


class CategoryViewSet(SellerScopedModelViewSet):
    serializer_class = CategorySerializer

    def get_queryset(self):
        user = self.request.user
        if is_admin_user(user) and not self.request.query_params.get("seller_id"):
            return Category.objects.all()
        return Category.objects.filter(seller=self.get_seller())

    def perform_create(self, serializer):
        serializer.save(seller=self.get_seller())


class ReviewViewSet(SellerScopedModelViewSet):
    http_method_names = ["get", "patch", "head", "options"]

    def get_serializer_class(self):
        # Use the reviews app serializer
        from reviews.serializers import ReviewSerializer
        return ReviewSerializer

    def get_queryset(self):
        user = self.request.user
        if is_admin_user(user) and not self.request.query_params.get("seller_id"):
            # Admin can see all reviews
            return Review.objects.select_related("product", "user").all()
        else:
            # Sellers can only see reviews for their products
            seller = self.get_seller()
            return Review.objects.select_related("product", "user").filter(
                product__shop__seller=seller
            )

    def update(self, request, *args, **kwargs):
        # Allow updating review status
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Only allow updating status field for now
        allowed_fields = ['status']
        filtered_data = {k: v for k, v in request.data.items() if k in allowed_fields}
        
        serializer = self.get_serializer(instance, data=filtered_data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)


class CouponViewSet(SellerScopedModelViewSet):
    serializer_class = CouponSerializer

    def get_queryset(self):
        user = self.request.user
        if is_admin_user(user) and not self.request.query_params.get("seller_id"):
            return Coupon.objects.all()
        return Coupon.objects.filter(seller=self.get_seller())

    def perform_create(self, serializer):
        serializer.save(seller=self.get_seller())
    
    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        """Toggle coupon active status (pause/unpause)"""
        coupon = self.get_object()
        coupon.is_active = not coupon.is_active
        coupon.save(update_fields=['is_active'])
        
        status_text = "activated" if coupon.is_active else "paused"
        return Response({
            'message': f'Coupon {coupon.code} has been {status_text}',
            'is_active': coupon.is_active
        })
    
    @action(detail=False, methods=['get'])
    def products(self, request):
        """Get seller's products for coupon selection"""
        user = self.request.user
        if is_admin_user(user) and not self.request.query_params.get("seller_id"):
            # Admin users can see all active products
            products = Product.objects.filter(status='Active').order_by('title')
        else:
            # Regular sellers see only their own products
            seller = self.get_seller()
            products = Product.objects.filter(shop__seller=seller, status='Active').order_by('title')
        
        serializer = SellerProductPreviewSerializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get global product categories for coupon selection"""
        from products.models import Category as ProductCategory
        from products.serializers import CategorySerializer as ProductCategorySerializer
        
        # All users (sellers and admins) can see global product categories
        categories = ProductCategory.objects.filter(is_active=True).order_by('name')
        serializer = ProductCategorySerializer(categories, many=True)
        return Response(serializer.data)


class CustomersAPIView(APIView):
    permission_classes = [IsSellerOrAdmin]

    def get(self, request):
        user = request.user
        if is_admin_user(user) and request.query_params.get("scope") != "seller":
            spent_expr = ExpressionWrapper(
                F("items__price") * F("items__quantity"), output_field=DecimalField(max_digits=12, decimal_places=2)
            )
            queryset = (
                Order.objects.values(
                    "customer_id",
                    "customer__username",
                    "customer__email",
                    "customer__date_joined",
                    "customer__is_active",
                )
                .annotate(orders=Count("id", distinct=True), spent=Sum(spent_expr))
                .order_by("-spent")
            )
        else:
            spent_expr = ExpressionWrapper(
                F("price") * F("quantity"), output_field=DecimalField(max_digits=12, decimal_places=2)
            )
            queryset = (
                OrderItem.objects.filter(product__shop__seller=user)
                .values(
                    "order__customer_id",
                    "order__customer__username",
                    "order__customer__email",
                    "order__customer__date_joined",
                    "order__customer__is_active",
                )
                .annotate(
                    orders=Count("order", distinct=True),
                    spent=Sum(spent_expr),
                )
                .order_by("-spent")
            )

        customers = []
        for row in queryset:
            customer_id = row.get("customer_id") or row.get("order__customer_id")
            username = row.get("customer__username") or row.get("order__customer__username")
            email = row.get("customer__email") or row.get("order__customer__email")
            joined = row.get("customer__date_joined") or row.get("order__customer__date_joined")
            is_active = row.get("customer__is_active")
            if is_active is None:
                is_active = row.get("order__customer__is_active")

            customers.append(
                {
                    "id": customer_id,
                    "name": username or email or "Customer",
                    "email": email or "",
                    "orders": row.get("orders", 0),
                    "spent": float(row.get("spent") or 0),
                    "joined": joined.date().isoformat() if joined else None,
                    "status": "Active" if is_active else "Blocked",
                }
            )

        return Response(customers)


class CustomerDetailAPIView(APIView):
    permission_classes = [IsSellerOrAdmin]

    def _build_response(self, customer, orders_qs, request):
        # Pull actual name from CustomerProfile
        cp = getattr(customer, 'customer_profile', None)
        first_name = (cp.first_name if cp else None) or customer.first_name or ""
        last_name = (cp.last_name if cp else None) or customer.last_name or ""
        phone = (cp.phone if cp else None) or ""

        # Account stats
        total_orders = orders_qs.count()
        spent_expr = ExpressionWrapper(
            F("items__price") * F("items__quantity"),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )
        total_spent = orders_qs.aggregate(total=Sum(spent_expr))["total"] or 0
        cancelled_count = orders_qs.filter(status="cancelled").count()
        delivered_count = orders_qs.filter(status="delivered").count()
        return_count = sum(o.return_requests.count() for o in orders_qs)

        # Last shipping address from most recent order
        last_order = orders_qs.first()
        last_address = None
        if last_order:
            last_address = {
                "full_name": last_order.shipping_full_name,
                "phone": last_order.shipping_phone,
                "street": last_order.shipping_street,
                "city": last_order.shipping_city,
                "state": last_order.shipping_state,
                "zip_code": last_order.shipping_zip_code,
                "country": last_order.shipping_country,
            }

        # Recent orders (last 10) — full detail
        recent_orders = []
        for o in orders_qs[:10]:
            items_detail = []
            for item in o.items.all():
                product = item.product
                # Build product image URL
                image_url = item.product_image or ""
                shop_name = ""
                product_slug = None
                product_category_slug = None
                if product:
                    shop_name = product.shop.name if product.shop else ""
                    if not image_url and product.image:
                        try:
                            image_url = request.build_absolute_uri(product.image.url)
                        except Exception:
                            image_url = ""
                    product_slug = getattr(product, 'slug', None)
                    cat = getattr(product, 'category_fk', None)
                    product_category_slug = cat.slug if cat else None

                items_detail.append({
                    "id": item.id,
                    "product_id": product.id if product else None,
                    "title": item.product_title,
                    "image": image_url,
                    "quantity": item.quantity,
                    "price": float(item.price),
                    "total": float(item.price * item.quantity),
                    "color": item.color or "",
                    "size": item.size or "",
                    "shop_name": shop_name,
                    "product_slug": product_slug,
                    "category_slug": product_category_slug,
                })

            recent_orders.append({
                "id": o.id,
                "order_id": o.order_id,
                "status": o.status,
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "subtotal": float(o.subtotal),
                "shipping_cost": float(o.shipping_cost),
                "discount": float(o.discount),
                "total_amount": float(o.total_amount),
                "created_at": o.created_at.isoformat(),
                "items_count": o.items.count(),
                "items_preview": [{"title": i["title"], "quantity": i["quantity"], "price": i["price"]} for i in items_detail[:3]],
                "items": items_detail,
                "shipping": {
                    "full_name": o.shipping_full_name,
                    "phone": o.shipping_phone,
                    "street": o.shipping_street,
                    "city": o.shipping_city,
                    "state": o.shipping_state,
                    "zip_code": o.shipping_zip_code,
                    "country": o.shipping_country,
                },
            })

        # Admin note from CustomerProfile
        admin_note = (cp.admin_note if cp and hasattr(cp, 'admin_note') else "") or ""

        # last_login: use profile's tracked_last_login if available, else Django's last_login
        tracked_login = (cp.last_login_at if cp and hasattr(cp, 'last_login_at') else None)
        last_login = tracked_login or customer.last_login

        return Response({
            "id": customer.id,
            "username": customer.username,
            "email": customer.email,
            "first_name": first_name,
            "last_name": last_name,
            "phone": phone or (last_address["phone"] if last_address else ""),
            "date_joined": customer.date_joined.isoformat(),
            "last_login": last_login.isoformat() if last_login else None,
            "is_active": customer.is_active,
            "status": "Active" if customer.is_active else "Blocked",
            "admin_note": admin_note,
            "last_address": last_address,
            "stats": {
                "total_orders": total_orders,
                "total_spent": float(total_spent),
                "delivered_count": delivered_count,
                "cancelled_count": cancelled_count,
                "return_refund_count": return_count,
                "avg_order_value": round(float(total_spent) / total_orders, 2) if total_orders else 0,
            },
            "recent_orders": recent_orders,
        })

    def get(self, request, customer_id):
        user = request.user
        try:
            customer = User.objects.select_related('customer_profile').get(id=customer_id)
        except User.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)

        if is_admin_user(user):
            orders_qs = Order.objects.filter(customer=customer).prefetch_related(
                "items", "items__product", "items__product__shop", "items__product__category_fk", "return_requests"
            ).order_by("-created_at")
        else:
            orders_qs = Order.objects.filter(
                customer=customer, items__product__shop__seller=user
            ).distinct().prefetch_related(
                "items", "items__product", "items__product__shop", "items__product__category_fk", "return_requests"
            ).order_by("-created_at")

        return self._build_response(customer, orders_qs, request)

    def patch(self, request, customer_id):
        """Update admin note for a customer"""
        try:
            customer = User.objects.select_related('customer_profile').get(id=customer_id)
        except User.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)

        from users.models import CustomerProfile
        cp, _ = CustomerProfile.objects.get_or_create(user=customer)
        note = request.data.get("admin_note", "")
        if hasattr(cp, 'admin_note'):
            cp.admin_note = note
            cp.save(update_fields=['admin_note'])
            return Response({"success": True, "admin_note": note})
        return Response({"error": "admin_note field not available — run migrations"}, status=400)


class AnalyticsAPIView(APIView):
    permission_classes = [IsSellerOrAdmin]

    def _seller_orders(self, seller):
        if is_admin_user(seller):
            return Order.objects.all()
        return (
            Order.objects.filter(items__product__shop__seller=seller)
            .distinct()
            .prefetch_related("items")
        )

    def _seller_order_items(self, seller):
        if is_admin_user(seller):
            return OrderItem.objects.all()
        return OrderItem.objects.filter(product__shop__seller=seller)

    def _seller_products(self, seller):
        if is_admin_user(seller):
            return Product.objects.all()
        return Product.objects.filter(shop__seller=seller)

    def get(self, request):
        seller = request.user
        orders = self._seller_orders(seller)
        order_items = self._seller_order_items(seller)
        products = self._seller_products(seller)

        revenue_expr = ExpressionWrapper(
            F("price") * F("quantity"), output_field=DecimalField(max_digits=12, decimal_places=2)
        )
        total_revenue = order_items.aggregate(total=Sum(revenue_expr)).get("total") or 0
        unique_visitors = orders.values("customer").distinct().count()
        page_views = sum((p.reviews_count * 12) + (p.sold_count * 8) + 30 for p in products)
        avg_session_minutes = 2 + (orders.count() % 5)
        avg_session_seconds = 10 + (products.count() % 50)
        conversion_rate = round((orders.count() / unique_visitors) * 100, 2) if unique_visitors else 0

        today = timezone.now().date()
        weekly_traffic = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            day_orders = orders.filter(created_at__date=day).count()
            visitors = max(day_orders * 7, 0) + max(products.count(), 1)
            views = visitors * 3 + day_orders * 5
            weekly_traffic.append(
                {
                    "day": day.strftime("%a"),
                    "visitors": visitors,
                    "pageViews": views,
                }
            )

        monthly_rates = []
        current_month_start = today.replace(day=1)
        for i in range(11, -1, -1):
            month_start = (current_month_start - timedelta(days=i * 30)).replace(day=1)
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            month_orders = orders.filter(created_at__date__gte=month_start, created_at__date__lt=next_month).count()
            inferred_visitors = max(month_orders * 8, 1)
            monthly_rates.append(
                {
                    "month": month_start.strftime("%b"),
                    "rate": round((month_orders / inferred_visitors) * 100, 2),
                }
            )

        top_pages = []
        top_products = products.order_by("-sold_count", "-reviews_count")[:5]
        for product in top_products:
            views = (product.sold_count * 20) + (product.reviews_count * 10) + 50
            bounce = max(12, min(85, int(55 - float(product.rating or 0) * 6)))
            top_pages.append(
                {
                    "page": f"/products/{product.id}",
                    "views": views,
                    "bounceRate": f"{bounce}%",
                }
            )

        stats = [
            {
                "label": "Page Views",
                "value": f"{page_views:,}",
                "change": "+7%",
            },
            {
                "label": "Unique Visitors",
                "value": f"{unique_visitors:,}",
                "change": "+5%",
            },
            {
                "label": "Avg Session",
                "value": f"{avg_session_minutes}m {avg_session_seconds}s",
                "change": "+2%",
            },
            {
                "label": "Conversion Rate",
                "value": f"{conversion_rate}%",
                "change": "+0.3%",
            },
        ]

        return Response(
            {
                "stats": stats,
                "weeklyTraffic": weekly_traffic,
                "conversionTrend": monthly_rates,
                "topPages": top_pages,
                "meta": {
                    "revenue": float(total_revenue),
                    "orders": orders.count(),
                    "products": products.count(),
                    "customers": unique_visitors,
                },
            }
        )


class TransactionsAPIView(APIView):
    permission_classes = [IsSellerOrAdmin]

    def _map_status(self, status_value):
        if status_value == "completed":
            return "Completed"
        if status_value == "cancelled":
            return "Refunded"
        return "Pending"

    def _payment_method(self, order_id):
        methods = ["Credit Card", "PayPal", "Bank Transfer"]
        return methods[order_id % len(methods)]

    def get(self, request):
        user = request.user
        if is_admin_user(user) and request.query_params.get("scope") != "seller":
            orders = Order.objects.all().prefetch_related("items", "customer")
            item_queryset = OrderItem.objects.all()
            setting, _ = PaymentMethodSetting.objects.get_or_create(seller=user)
        else:
            orders = (
                Order.objects.filter(items__product__shop__seller=user)
                .distinct()
                .prefetch_related("items", "customer")
            )
            item_queryset = OrderItem.objects.filter(product__shop__seller=user)
            setting, _ = PaymentMethodSetting.objects.get_or_create(seller=user)

        transactions = []
        for order in orders.order_by("-created_at"):
            if is_admin_user(user) and request.query_params.get("scope") != "seller":
                amount = sum((item.price * item.quantity) for item in order.items.all())
            else:
                amount = sum(
                    (item.price * item.quantity)
                    for item in order.items.all()
                    if item.product and item.product.shop.seller_id == user.id
                )

            transactions.append(
                {
                    "id": f"TXN-{order.id:05d}",
                    "order": f"ORD-{order.id:05d}",
                    "customer": order.customer.username if order.customer else "Guest",
                    "amount": float(amount),
                    "method": self._payment_method(order.id),
                    "status": self._map_status(order.status),
                    "date": order.created_at.date().isoformat(),
                }
            )

        total_revenue = sum(t["amount"] for t in transactions if t["status"] == "Completed")
        pending_total = sum(t["amount"] for t in transactions if t["status"] == "Pending")
        refunded_total = sum(t["amount"] for t in transactions if t["status"] == "Refunded")

        return Response(
            {
                "summary": {
                    "totalRevenue": round(total_revenue, 2),
                    "pending": round(pending_total, 2),
                    "refunded": round(refunded_total, 2),
                },
                "paymentMethods": PaymentMethodSettingSerializer(setting).data,
                "transactions": transactions,
            }
        )


class PaymentMethodSettingsAPIView(APIView):
    permission_classes = [IsSellerOrAdmin]

    def patch(self, request):
        setting, _ = PaymentMethodSetting.objects.get_or_create(seller=request.user)
        serializer = PaymentMethodSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
