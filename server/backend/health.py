from django.http import JsonResponse
from django.db import connection
from django.conf import settings
import os

def health_check(request):
    """Health check endpoint for production monitoring"""
    try:
        # Check database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        
        # Check if critical directories exist
        media_exists = os.path.exists(settings.MEDIA_ROOT)
        static_exists = os.path.exists(settings.STATIC_ROOT)
        
        return JsonResponse({
            'status': 'healthy',
            'database': 'connected',
            'media_directory': 'exists' if media_exists else 'missing',
            'static_directory': 'exists' if static_exists else 'missing',
            'debug': settings.DEBUG
        })
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e)
        }, status=500)