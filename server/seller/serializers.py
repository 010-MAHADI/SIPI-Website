from decimal import Decimal

from rest_framework import serializers

from products.models import Product

from .models import Category, Coupon, PaymentMethodSetting


class SellerProductPreviewSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="title")

    class Meta:
        model = Product
        fields = ["id", "name", "price", "image", "sold_count"]


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    products = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "image_url",
            "status",
            "created_at",
            "updated_at",
            "product_count",
            "products",
        ]
        read_only_fields = ["slug", "created_at", "updated_at", "product_count", "products"]

    def get_product_queryset(self, obj):
        # Get products that belong to this seller category by name
        # Since products can have category as string or FK to products.Category,
        # we need to check both
        from django.db.models import Q
        from products.models import Category as ProductCategory
        
        # Try to find a matching global category
        try:
            global_category = ProductCategory.objects.get(name__iexact=obj.name.strip())
            return Product.objects.filter(
                Q(shop__seller=obj.seller) & 
                (Q(category__iexact=obj.name.strip()) | Q(category_fk=global_category))
            ).order_by("-created_at")
        except ProductCategory.DoesNotExist:
            # If no global category exists, just match by string
            return Product.objects.filter(
                shop__seller=obj.seller,
                category__iexact=obj.name.strip()
            ).order_by("-created_at")

    def get_product_count(self, obj):
        return self.get_product_queryset(obj).count()

    def get_products(self, obj):
        products = self.get_product_queryset(obj)[:8]
        return SellerProductPreviewSerializer(
            products, many=True, context=self.context
        ).data

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Category name is required.")
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            queryset = Category.objects.filter(seller=request.user, name__iexact=cleaned)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("Category with this name already exists.")
        return cleaned


class CouponSerializer(serializers.ModelSerializer):
    discount = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    selected_products = serializers.SerializerMethodField()
    product_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)

    class Meta:
        model = Coupon
        fields = [
            "id",
            "code",
            "discount_type",
            "discount_value",
            "coupon_type",
            "category",
            "category_name",
            "min_order_amount",
            "selected_products",
            "product_ids",
            "discount",
            "uses",
            "max_uses",
            "expires_at",
            "is_active",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "uses", "discount", "status", "selected_products", "category_name"]
        extra_kwargs = {
            'code': {'required': False},
            'expires_at': {'required': False},
        }

    def get_discount(self, obj):
        if obj.discount_type == "percent":
            return f"{obj.discount_value}%"
        if obj.discount_type == "fixed":
            return f"${obj.discount_value}"
        return "Free Shipping"

    def get_status(self, obj):
        if not obj.is_active:
            return "Inactive"
        if obj.uses >= obj.max_uses:
            return "Used Up"
        return "Active"
    
    def get_selected_products(self, obj):
        if obj.coupon_type == "specific_products":
            products = Product.objects.filter(couponproduct__coupon=obj)
            return [{"id": p.id, "title": p.title, "price": str(p.price)} for p in products]
        return []

    def validate_code(self, value):
        code = value.strip().upper()
        if not code:
            raise serializers.ValidationError("Coupon code is required.")
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            queryset = Coupon.objects.filter(seller=request.user, code=code)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("Coupon code already exists.")
        return code

    def validate_discount_value(self, value):
        if value < Decimal("0"):
            raise serializers.ValidationError("Discount must be non-negative.")
        return value

    def validate_max_uses(self, value):
        if value <= 0:
            raise serializers.ValidationError("Max uses must be greater than zero.")
        return value
    
    def validate(self, attrs):
        # Only validate required fields for creation or when the fields are being updated
        coupon_type = attrs.get('coupon_type')
        category = attrs.get('category')
        product_ids = attrs.get('product_ids', [])
        
        # If this is an update and coupon_type is not being changed, get it from instance
        if self.instance and coupon_type is None:
            coupon_type = self.instance.coupon_type
        
        # Only validate category requirement if coupon_type is being set to 'category'
        if coupon_type == 'category':
            # For updates, check if category is being provided or already exists
            if self.instance:
                existing_category = self.instance.category
                if not category and not existing_category:
                    raise serializers.ValidationError("Category is required when coupon type is 'category'.")
            else:
                # For creation, category is required
                if not category:
                    raise serializers.ValidationError("Category is required when coupon type is 'category'.")
        
        # Only validate product selection requirement if coupon_type is being set to 'specific_products'
        if coupon_type == 'specific_products':
            # For updates, check if products are being provided or already exist
            if self.instance:
                existing_products = self.instance.coupon_products.exists() if hasattr(self.instance, 'coupon_products') else False
                if not product_ids and not existing_products:
                    raise serializers.ValidationError("Product selection is required when coupon type is 'specific_products'.")
            else:
                # For creation, products are required
                if not product_ids:
                    raise serializers.ValidationError("Product selection is required when coupon type is 'specific_products'.")
            
        return attrs
    
    def create(self, validated_data):
        product_ids = validated_data.pop('product_ids', [])
        coupon = super().create(validated_data)
        
        # Handle specific products
        if coupon.coupon_type == 'specific_products' and product_ids:
            from .models import CouponProduct
            for product_id in product_ids:
                try:
                    product = Product.objects.get(id=product_id, shop__seller=coupon.seller)
                    CouponProduct.objects.create(coupon=coupon, product=product)
                except Product.DoesNotExist:
                    continue
        
        return coupon
    
    def update(self, instance, validated_data):
        product_ids = validated_data.pop('product_ids', [])
        coupon = super().update(instance, validated_data)
        
        # Handle specific products update
        if coupon.coupon_type == 'specific_products':
            # Clear existing products
            coupon.coupon_products.all().delete()
            
            # Add new products
            if product_ids:
                from .models import CouponProduct
                for product_id in product_ids:
                    try:
                        product = Product.objects.get(id=product_id, shop__seller=coupon.seller)
                        CouponProduct.objects.create(coupon=coupon, product=product)
                    except Product.DoesNotExist:
                        continue
        
        return coupon


class PaymentMethodSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethodSetting
        fields = ["cash_on_delivery", "bkash", "nagad", "credit_card", "updated_at"]
        read_only_fields = ["updated_at"]
