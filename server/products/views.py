from urllib.parse import urlparse

from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from django.utils.text import slugify

from users.roles import is_admin_user, is_seller_user
from users.services import ensure_admin_shop

from .models import Category, Shop, Product
from .serializers import CategorySerializer, ShopSerializer, ProductSerializer

SELLER_MAX_SHOPS = 5


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.filter(is_active=True)
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.AllowAny]
        else:
            # Only admins can create/update/delete categories
            permission_classes = [permissions.IsAdminUser]
        return [permission() for permission in permission_classes]


class ShopViewSet(viewsets.ModelViewSet):
    queryset = Shop.objects.all()
    serializer_class = ShopSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        if self.action in ['list', 'retrieve']:
            return Shop.objects.all()
        if is_admin_user(self.request.user):
            return Shop.objects.all()
        return Shop.objects.filter(seller=self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        if is_admin_user(user):
            raise ValidationError("Main admin has one fixed Flypick shop and cannot create more shops.")
        if not is_seller_user(user):
            raise PermissionDenied("Only seller accounts can create shops.")
        if user.shops.count() >= SELLER_MAX_SHOPS:
            raise ValidationError(f"Sellers can create a maximum of {SELLER_MAX_SHOPS} shops.")

        serializer.save(seller=self.request.user)

    def perform_destroy(self, instance):
        if is_admin_user(self.request.user) and instance.seller_id == self.request.user.id:
            raise ValidationError("Main admin fixed Flypick shop cannot be deleted.")
        super().perform_destroy(instance)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="mine",
    )
    def mine(self, request):
        if is_admin_user(request.user):
            ensure_admin_shop(request.user)
        queryset = Shop.objects.filter(seller=request.user).order_by("id")
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.AllowAny]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        base_qs = Product.objects.select_related('shop', 'category_fk').prefetch_related('gallery_images', 'gallery_videos')
        
        # For public access (list/retrieve without auth or for customers)
        if self.action in ['list', 'retrieve']:
            # If user is authenticated and is a seller/admin, filter by their shops
            if self.request.user and self.request.user.is_authenticated:
                if is_admin_user(self.request.user):
                    # Admin can see all products, but filter by shop param if provided
                    shop_id = self.request.query_params.get('shop')
                    if shop_id:
                        return base_qs.filter(shop_id=shop_id)
                    return base_qs
                elif is_seller_user(self.request.user):
                    # Sellers see only their shop's products
                    shop_id = self.request.query_params.get('shop')
                    user_shop_ids = Shop.objects.filter(seller=self.request.user).values_list('id', flat=True)
                    if shop_id:
                        # Verify the shop belongs to the seller
                        if int(shop_id) in user_shop_ids:
                            return base_qs.filter(shop_id=shop_id)
                        else:
                            # Return empty queryset if trying to access other's shop
                            return base_qs.none()
                    return base_qs.filter(shop_id__in=user_shop_ids)
            # Public access - return all products
            return base_qs

        # For create/update/delete actions
        if is_admin_user(self.request.user):
            return base_qs

        user_shop_ids = Shop.objects.filter(seller=self.request.user).values_list('id', flat=True)
        return base_qs.filter(shop_id__in=user_shop_ids)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.AllowAny],
        url_path="resolve",
    )
    def resolve(self, request):
        category_slug = (request.query_params.get("category") or "").strip()
        product_slug = (request.query_params.get("slug") or "").strip()

        if not category_slug or not product_slug:
            raise ValidationError("Both category and slug query parameters are required.")

        matched_product = None
        for product in self.get_queryset():
            normalized_category = slugify(
                getattr(product.category_fk, "name", None)
                or product.category
                or getattr(product.shop, "category", None)
                or "products"
            )
            normalized_product = slugify(product.meta_title or product.title or "")

            if normalized_category != category_slug:
                continue
            if normalized_product == product_slug or f"{normalized_product}-{product.id}" == product_slug:
                matched_product = product
                break

        if not matched_product:
            raise NotFound("Product not found for the provided category and slug.")

        serializer = self.get_serializer(matched_product)
        return Response(serializer.data)

    def perform_create(self, serializer):
        user = self.request.user
        shop_id = self.request.data.get('shop')

        if is_admin_user(user):
            if shop_id:
                try:
                    shop = Shop.objects.get(id=shop_id)
                except Shop.DoesNotExist:
                    raise ValidationError("Shop not found.")
            else:
                shop = ensure_admin_shop(user)
            serializer.save(shop=shop)
            return

        try:
            shop = Shop.objects.get(id=shop_id, seller=self.request.user)
            serializer.save(shop=shop)
        except Shop.DoesNotExist:
            raise ValidationError("Shop not found or you don't own it.")
    
    def perform_update(self, serializer):
        if not is_admin_user(self.request.user) and serializer.instance.shop.seller != self.request.user:
            raise PermissionDenied("You don't have permission to update this product.")
        serializer.save()
    
    def perform_destroy(self, instance):
        if not is_admin_user(self.request.user) and instance.shop.seller != self.request.user:
            raise PermissionDenied("You don't have permission to delete this product.")
        instance.delete()

    @staticmethod
    def _normalize_path(raw_url):
        if not raw_url:
            return None
        value = str(raw_url).strip()
        if not value:
            return None
        parsed = urlparse(value)
        path = parsed.path if parsed.scheme or parsed.netloc else value
        if not path.startswith('/'):
            path = f'/{path}'
        return path

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="sync-media",
    )
    def sync_media(self, request, pk=None):
        product = self.get_object()
        if not is_admin_user(request.user) and product.shop.seller != request.user:
            raise PermissionDenied("You don't have permission to update this product media.")

        keep_image_urls = request.data.get("keep_image_urls", [])
        keep_video_urls = request.data.get("keep_video_urls", [])
        keep_image_paths = []
        keep_video_paths = []
        seen_image_paths = set()
        seen_video_paths = set()

        if isinstance(keep_image_urls, list):
            for url in keep_image_urls:
                path = self._normalize_path(url)
                if path and path not in seen_image_paths:
                    seen_image_paths.add(path)
                    keep_image_paths.append(path)

        if isinstance(keep_video_urls, list):
            for url in keep_video_urls:
                path = self._normalize_path(url)
                if path and path not in seen_video_paths:
                    seen_video_paths.add(path)
                    keep_video_paths.append(path)

        image_media = list(product.gallery_images.all())
        video_media = list(product.gallery_videos.all())
        image_path_to_media = {self._normalize_path(item.image.url): item for item in image_media if item.image}
        video_path_to_media = {self._normalize_path(item.video.url): item for item in video_media if item.video}

        for path, item in list(image_path_to_media.items()):
            if path not in seen_image_paths:
                item.image.delete(save=False)
                item.delete()
                image_path_to_media.pop(path, None)

        for path, item in list(video_path_to_media.items()):
            if path not in seen_video_paths:
                item.video.delete(save=False)
                item.delete()
                video_path_to_media.pop(path, None)

        for idx, path in enumerate(keep_image_paths):
            media = image_path_to_media.get(path)
            if media and media.sort_order != idx:
                media.sort_order = idx
                media.save(update_fields=["sort_order"])

        for idx, path in enumerate(keep_video_paths):
            media = video_path_to_media.get(path)
            if media and media.sort_order != idx:
                media.sort_order = idx
                media.save(update_fields=["sort_order"])

        changed_fields = []

        old_image_path = self._normalize_path(product.image.url) if product.image else None
        if keep_image_paths:
            first_image_path = keep_image_paths[0]
            main_image_media = image_path_to_media.get(first_image_path)
            if main_image_media and product.image != main_image_media.image:
                product.image = main_image_media.image.name
                changed_fields.append("image")
            elif not main_image_media and old_image_path != first_image_path:
                # If the previous main image was removed and first path is not resolvable, clear it.
                product.image = None
                if "image" not in changed_fields:
                    changed_fields.append("image")
        elif product.image:
            product.image = None
            changed_fields.append("image")

        old_video_path = self._normalize_path(product.video.url) if product.video else None
        if keep_video_paths:
            first_video_path = keep_video_paths[0]
            main_video_media = video_path_to_media.get(first_video_path)
            if main_video_media and product.video != main_video_media.video:
                product.video = main_video_media.video.name
                changed_fields.append("video")
            elif not main_video_media and old_video_path != first_video_path:
                product.video = None
                if "video" not in changed_fields:
                    changed_fields.append("video")
        elif product.video:
            product.video = None
            changed_fields.append("video")

        if changed_fields:
            if "updated_at" not in changed_fields:
                changed_fields.append("updated_at")
            product.save(update_fields=changed_fields)

        serializer = self.get_serializer(product)
        return Response(serializer.data)
