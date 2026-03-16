#!/bin/bash

echo "🔍 Diagnosing Django Environment Issue..."
echo "========================================"

# Check current Python and pip
echo "📍 Current Python version:"
python3 --version
echo ""

echo "📍 Current pip version:"
pip --version
echo ""

echo "📍 Virtual environment status:"
echo "VIRTUAL_ENV: $VIRTUAL_ENV"
echo ""

echo "📍 Python path:"
which python3
echo ""

echo "📍 Pip path:"
which pip
echo ""

echo "📦 Checking installed packages:"
pip list | grep -i django
echo ""

echo "🔧 Installing/Reinstalling Django and dependencies..."
echo ""

# Install Django and required packages
pip install --upgrade pip
pip install django
pip install djangorestframework
pip install django-cors-headers
pip install djangorestframework-simplejwt
pip install python-dotenv
pip install pillow
pip install psycopg2-binary
pip install gunicorn
pip install whitenoise

echo ""
echo "✅ Installation complete!"
echo ""

echo "🧪 Testing Django installation:"
python3 -c "import django; print(f'Django version: {django.get_version()}')"
echo ""

echo "📋 Final package list:"
pip list
echo ""

echo "🚀 Now try running your Django commands:"
echo "python3 manage.py makemigrations"
echo "python3 manage.py migrate"