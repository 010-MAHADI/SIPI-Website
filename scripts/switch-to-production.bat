@echo off
echo Switching to Production Environment...
echo.

REM Copy production environment files
echo Copying production environment files...
copy "server\.env.production" "server\.env" >nul
copy "client\Customer_site\.env.production" "client\Customer_site\.env" >nul

REM Create seller-side production env if it doesn't exist
echo # Production Environment Variables for Seller Dashboard > "client\seller-side\.env"
echo VITE_API_BASE_URL=http://54.169.101.239/api >> "client\seller-side\.env"
echo VITE_MEDIA_URL=http://54.169.101.239/media >> "client\seller-side\.env"
echo VITE_SITE_NAME=Flypick >> "client\seller-side\.env"
echo VITE_CUSTOMER_URL=http://54.169.101.239 >> "client\seller-side\.env"

echo.
echo ✅ Production environment configured!
echo.
echo Production URLs:
echo - Customer Site: http://54.169.101.239 (port 80)
echo - Seller Dashboard: http://54.169.101.239:8080 (port 8080)
echo - API Server: http://54.169.101.239/api (Django backend)
echo.
echo Configuration Details:
echo - DEBUG=False (Production mode)
echo - Database: PostgreSQL (USE_SQLITE=False)
echo - Security: HTTP (SSL disabled for IP-based deployment)
echo - CORS: Configured for production URLs
echo.
echo Next steps:
echo 1. Update database credentials in server\.env if needed
echo 2. Build the frontend applications:
echo    cd client/Customer_site && npm run build
echo    cd client/seller-side && npm run build
echo.
echo 3. Start the Django server:
echo    cd server && python manage.py runserver 0.0.0.0:8000
echo.
echo 4. Configure and start Nginx with the provided nginx.conf
echo.
pause