from django.contrib.auth import get_user_model
from django.test import override_settings
from decimal import Decimal
from rest_framework import status
from rest_framework.test import APITestCase, APIRequestFactory

from orders.models import Order, OrderItem
from orders.serializers import OrderCreateSerializer
from products.models import Product, Shop
from seller.models import PaymentMethodSetting


User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class PaymentMethodIntegrationTest(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="pass1234",
            role="Admin",
        )
        self.seller_user = User.objects.create_user(
            username="seller",
            email="seller@example.com",
            password="pass1234",
            role="Seller",
        )
        self.customer_user = User.objects.create_user(
            username="customer",
            email="customer@example.com",
            password="pass1234",
            role="Customer",
        )

    def test_customer_checkout_payment_methods_use_admin_setting(self):
        PaymentMethodSetting.objects.create(
            seller=self.seller_user,
            cash_on_delivery=True,
            bkash=True,
            nagad=True,
            credit_card=True,
        )
        PaymentMethodSetting.objects.create(
            seller=self.admin_user,
            cash_on_delivery=False,
            bkash=True,
            nagad=True,
            credit_card=True,
        )

        self.client.force_authenticate(user=self.customer_user)
        response = self.client.get("/api/orders/payment-methods/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["cash_on_delivery"])
        self.assertTrue(response.data["bkash"])
        self.assertTrue(response.data["nagad"])
        self.assertTrue(response.data["credit_card"])

    def test_disabled_payment_method_is_rejected_by_order_serializer(self):
        PaymentMethodSetting.objects.create(
            seller=self.admin_user,
            cash_on_delivery=False,
            bkash=True,
            nagad=True,
            credit_card=True,
        )

        serializer = OrderCreateSerializer(
            data={
                "shipping_full_name": "Test User",
                "shipping_phone": "01700000000",
                "shipping_street": "Road 1",
                "shipping_city": "Dhaka",
                "shipping_state": "",
                "shipping_zip_code": "1200",
                "shipping_country": "Bangladesh",
                "payment_method": "cod",
                "items": [
                    {
                        "product_id": 1,
                        "quantity": 1,
                        "color": "",
                        "size": "",
                    }
                ],
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("payment_method", serializer.errors)


@override_settings(SECURE_SSL_REDIRECT=False)
class SellerOrderIsolationTest(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            username="customer2",
            email="customer2@example.com",
            password="pass1234",
            role="Customer",
        )
        self.seller_one = User.objects.create_user(
            username="seller_one",
            email="seller1@example.com",
            password="pass1234",
            role="Seller",
        )
        self.seller_two = User.objects.create_user(
            username="seller_two",
            email="seller2@example.com",
            password="pass1234",
            role="Seller",
        )

        self.shop_one = Shop.objects.create(
            seller=self.seller_one,
            name="Shop One",
            category="General",
        )
        self.shop_two = Shop.objects.create(
            seller=self.seller_two,
            name="Shop Two",
            category="General",
        )

        self.product_one = Product.objects.create(
            shop=self.shop_one,
            title="Seller One Product",
            price=Decimal("100.00"),
        )
        self.product_two = Product.objects.create(
            shop=self.shop_two,
            title="Seller Two Product",
            price=Decimal("50.00"),
        )

    def test_each_seller_only_sees_own_order_items(self):
        order = Order.objects.create(
            customer=self.customer,
            order_id="FPTESTSHOP001",
            subtotal=Decimal("250.00"),
            total_amount=Decimal("250.00"),
            status="pending",
        )
        OrderItem.objects.create(
            order=order,
            product=self.product_one,
            product_title=self.product_one.title,
            quantity=2,
            price=Decimal("100.00"),
        )
        OrderItem.objects.create(
            order=order,
            product=self.product_two,
            product_title=self.product_two.title,
            quantity=1,
            price=Decimal("50.00"),
        )

        self.client.force_authenticate(user=self.seller_one)
        response_one = self.client.get("/api/orders/orders/")
        self.assertEqual(response_one.status_code, status.HTTP_200_OK)
        data_one = response_one.data.get("results", response_one.data)
        self.assertEqual(len(data_one), 1)
        self.assertEqual(len(data_one[0]["items"]), 1)
        self.assertEqual(data_one[0]["items"][0]["product_title"], "Seller One Product")
        self.assertEqual(Decimal(data_one[0]["total_amount"]), Decimal("200.00"))

        self.client.force_authenticate(user=self.seller_two)
        response_two = self.client.get("/api/orders/orders/")
        self.assertEqual(response_two.status_code, status.HTTP_200_OK)
        data_two = response_two.data.get("results", response_two.data)
        self.assertEqual(len(data_two), 1)
        self.assertEqual(len(data_two[0]["items"]), 1)
        self.assertEqual(data_two[0]["items"][0]["product_title"], "Seller Two Product")
        self.assertEqual(Decimal(data_two[0]["total_amount"]), Decimal("50.00"))


@override_settings(SECURE_SSL_REDIRECT=False)
class OrderCreationSignalRegressionTest(APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.customer = User.objects.create_user(
            username="signal_customer",
            email="signal_customer@example.com",
            password="pass1234",
            role="Customer",
        )
        self.seller = User.objects.create_user(
            username="signal_seller",
            email="signal_seller@example.com",
            password="pass1234",
            role="Seller",
        )
        self.shop = Shop.objects.create(
            seller=self.seller,
            name="Signal Shop",
            category="General",
        )
        self.product = Product.objects.create(
            shop=self.shop,
            title="Signal Product",
            price=Decimal("99.00"),
        )

    def test_order_create_serializer_is_not_broken_by_promotion_signal(self):
        request = self.factory.post("/api/orders/orders/")
        request.user = self.customer

        serializer = OrderCreateSerializer(
            data={
                "shipping_full_name": "Signal Customer",
                "shipping_phone": "01700000000",
                "shipping_street": "Road 1",
                "shipping_city": "Dhaka",
                "shipping_state": "",
                "shipping_zip_code": "1200",
                "shipping_country": "Bangladesh",
                "payment_method": "cod",
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": 1,
                        "color": "",
                        "size": "",
                    }
                ],
            },
            context={"request": request},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        order = serializer.save()

        self.assertEqual(order.customer, self.customer)
        self.assertEqual(order.items.count(), 1)
