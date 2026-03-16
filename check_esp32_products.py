#!/usr/bin/env python3
"""
Check for ESP32 products and their ratings
"""

import requests
import json

BASE_URL = "http://52.221.195.134"

def check_esp32_products():
    print("🔍 Checking ESP32 Products")
    print("=" * 50)
    
    try:
        response = requests.get(f"{BASE_URL}/api/products/")
        if response.status_code == 200:
            data = response.json()
            products = data.get('results', [])
            
            print(f"Total products: {len(products)}")
            
            # Find all ESP32 products
            esp32_products = [p for p in products if "ESP32" in p.get('title', '')]
            print(f"ESP32 products found: {len(esp32_products)}")
            
            for product in esp32_products:
                print(f"\nProduct ID {product.get('id')}:")
                print(f"  Title: {product.get('title')}")
                print(f"  Rating: {product.get('rating')}")
                print(f"  Reviews Count: {product.get('reviews_count')}")
                
                # Check reviews for this product
                product_id = product.get('id')
                reviews_response = requests.get(f"{BASE_URL}/api/products/{product_id}/reviews/")
                if reviews_response.status_code == 200:
                    reviews_data = reviews_response.json()
                    print(f"  Reviews API - Count: {reviews_data.get('count')}, Avg: {reviews_data.get('average_rating')}")
                    
                    if reviews_data.get('results'):
                        print(f"  Sample review: Rating {reviews_data['results'][0].get('rating')}")
            
            # Check all products for ratings
            print(f"\nAll products with ratings:")
            for product in products:
                rating = product.get('rating', 0)
                if rating > 0:
                    print(f"  ID {product.get('id')}: {product.get('title', '')[:40]}... - Rating: {rating}")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_esp32_products()