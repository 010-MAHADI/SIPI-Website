# Manual Production Deployment Guide

## Server Information
- **Server IP**: 54.169.101.239
- **Customer Domain**: flypick.shop
- **Seller Domain**: seller.flypick.shop

---

## Step 1: Server Preparation

### 1.1 Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Install Required Packages
```bash
# Install Python and pip
sudo apt install python3 python3-pip python3-venv -y

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
sudo apt install nginx -y

# Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Install Git
sudo apt install git -y

# Install SSL tools
sudo apt install certbot python3-certbot-nginx -y
```

### 1.3 Create Application User
```bash
sudo adduser flypick
sudo usermod -aG sudo flypick
sudo su - flypick
```

---

## Step 2: Database Setup

### 2.1 Configure PostgreSQL
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE flypick_production;
CREATE USER flypick_user WITH PASSWORD 'your_secure_password_here';
ALTER ROLE flypick_user SET client_encoding TO 'utf8';
ALTER ROLE flypick_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE flypick_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE flypick_production TO flypick_user;
\q
```

### 2.2 Test Database Connection
```bash
psql -h localhost -U flypick_user -d flypick_production
# Enter password when prompted
# If successful, type \q to exit
```

---

## Step 3: Clone and Setup Application

### 3.1 Clone Repository
```bash
cd /home/flypick
git clone https://github.com/010-MAHADI/SIPI-Website.git
cd SIPI-Website
```

### 3.2 Create Python Virtual Environment
```bash
cd server
python3 -m venv venv
source venv/bin/activate
```

### 3.3 Install Python Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.4 Configure Environment Variables
```bash
cp .env.example .env
nano .env
```

**Edit the .env file with these production values:**
```env
# Django Settings
SECRET_KEY=your-new-production-secret-key-generate-a-long-random-string
DEBUG=False
ALLOWED_HOSTS=54.169.101.239,flypick.shop,seller.flypick.shop,www.flypick.shop

# Database
USE_SQLITE=False
DB_ENGINE=django.db.backends.postgresql
DB_NAME=flypick_production
DB_USER=flypick_user
DB_PASSWORD=your_secure_password_here
DB_HOST=localhost
DB_PORT=5432

# CORS Settings
CORS_ALLOWED_ORIGINS=https://flypick.shop,https://seller.flypick.shop,https://www.flypick.shop

# JWT Settings
JWT_ACCESS_TOKEN_LIFETIME=15
JWT_REFRESH_TOKEN_LIFETIME=1440

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=True
SMTP_USER=boibazar00@gmail.com
SMTP_PASS=hntc hqdj bmjo ujdd
EMAIL_SENDER_NAME=Flypick

# Site Configuration
SITE_NAME=Flypick
FRONTEND_URL=https://flypick.shop
SELLER_FRONTEND_URL=https://seller.flypick.shop
```

---

## Step 4: Django Application Setup

### 4.1 Run Database Migrations
```bash
# Make sure you're in the server directory with venv activated
cd /home/flypick/SIPI-Website/server
source venv/bin/activate

# Run migrations
python manage.py makemigrations
python manage.py migrate
```

### 4.2 Create Superuser
```bash
python manage.py createsuperuser
# Follow prompts to create admin user
```

### 4.3 Setup Email Templates
```bash
python manage.py setup_email_templates
```

### 4.4 Collect Static Files
```bash
python manage.py collectstatic --noinput
```

### 4.5 Test Django Application
```bash
# Test the application
python manage.py runserver 0.0.0.0:8000

# Open another terminal and test
curl http://54.169.101.239:8000/api/health/

# Stop the test server (Ctrl+C)
```

---

## Step 5: Frontend Build

### 5.1 Build Customer Site
```bash
cd /home/flypick/SIPI-Website/client/Customer_site

# Install dependencies
npm install

# Create production environment file
cat > .env << EOF
VITE_API_BASE_URL=https://flypick.shop/api
VITE_MEDIA_URL=https://flypick.shop/media
VITE_SITE_NAME=Flypick
VITE_SELLER_URL=https://seller.flypick.shop
EOF

# Build for production
npm run build
```

### 5.2 Build Seller Dashboard
```bash
cd /home/flypick/SIPI-Website/client/seller-side

# Install dependencies
npm install

# Create production environment file
cat > .env << EOF
VITE_API_BASE_URL=https://flypick.shop/api
VITE_MEDIA_URL=https://flypick.shop/media
VITE_SITE_NAME=Flypick
VITE_CUSTOMER_URL=https://flypick.shop
EOF

# Build for production
npm run build
```

---

## Step 6: SSL Certificate Setup

### 6.1 Get SSL Certificates (Let's Encrypt)
```bash
# Stop nginx if running
sudo systemctl stop nginx

# Get certificates for both domains
sudo certbot certonly --standalone -d flypick.shop -d www.flypick.shop
sudo certbot certonly --standalone -d seller.flypick.shop

# Certificates will be saved in:
# /etc/letsencrypt/live/flypick.shop/
# /etc/letsencrypt/live/seller.flypick.shop/
```

---

## Step 7: Nginx Configuration

### 7.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/flypick
```

**Add this configuration:**
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name flypick.shop www.flypick.shop seller.flypick.shop;
    return 301 https://$server_name$request_uri;
}

# Main customer site (flypick.shop)
server {
    listen 443 ssl http2;
    server_name flypick.shop www.flypick.shop;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/flypick.shop/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flypick.shop/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    client_max_body_size 50M;
    
    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Admin panel
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files
    location /static/ {
        alias /home/flypick/SIPI-Website/server/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Media files
    location /media/ {
        alias /home/flypick/SIPI-Website/storage/;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    # Customer site frontend
    location / {
        root /home/flypick/SIPI-Website/client/Customer_site/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public";
    }
}

# Seller dashboard (seller.flypick.shop)
server {
    listen 443 ssl http2;
    server_name seller.flypick.shop;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/seller.flypick.shop/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seller.flypick.shop/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    client_max_body_size 50M;
    
    # API endpoints (proxy to main backend)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host flypick.shop;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files
    location /static/ {
        alias /home/flypick/SIPI-Website/server/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Media files
    location /media/ {
        alias /home/flypick/SIPI-Website/storage/;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    # Seller dashboard frontend
    location / {
        root /home/flypick/SIPI-Website/client/seller-side/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public";
    }
}
```

### 7.2 Enable Nginx Site
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/flypick /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# If test passes, restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 8: Create Systemd Service for Django

### 8.1 Create Gunicorn Service
```bash
sudo nano /etc/systemd/system/flypick.service
```

**Add this configuration:**
```ini
[Unit]
Description=Flypick Django Gunicorn Service
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/flypick/SIPI-Website/server

Environment="PATH=/home/flypick/SIPI-Website/server/venv/bin"

ExecStart=/home/flypick/SIPI-Website/server/venv/bin/gunicorn \
          --workers 3 \
          --bind 127.0.0.1:8000 \
          --access-logfile - \
          --error-logfile - \
          backend.wsgi:application

Restart=always
RestartSec=5
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

### 8.2 Start and Enable Service
```bash
# Reload systemd
sudo systemctl daemon-reload

# Start the service
sudo systemctl start flypick

# Enable service to start on boot
sudo systemctl enable flypick

# Check service status
sudo systemctl status flypick
```

---

## Step 9: Create Required Directories

### 9.1 Create Storage and Log Directories
```bash
# Create storage directory for media files
mkdir -p /home/flypick/SIPI-Website/storage

# Create logs directory
mkdir -p /home/flypick/SIPI-Website/server/logs

# Set proper permissions
chmod 755 /home/flypick/SIPI-Website/storage
chmod 755 /home/flypick/SIPI-Website/server/logs
```

---

## Step 10: Firewall Configuration

### 10.1 Configure UFW Firewall
```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Check firewall status
sudo ufw status
```

---

## Step 11: Testing and Verification

### 11.1 Test All Services
```bash
# Check if all services are running
sudo systemctl status postgresql
sudo systemctl status nginx
sudo systemctl status flypick

# Test database connection
cd /home/flypick/SIPI-Website/server
source venv/bin/activate
python manage.py dbshell
\q

# Test Django application
curl https://flypick.shop/api/health/
```

### 11.2 Test Websites
Open in browser:
- https://flypick.shop (Customer site)
- https://seller.flypick.shop (Seller dashboard)
- https://flypick.shop/admin/ (Admin panel)

### 11.3 Test Email System
```bash
cd /home/flypick/SIPI-Website/server
source venv/bin/activate
python test_email_system.py
```

---

## Step 12: SSL Certificate Auto-Renewal

### 12.1 Setup Auto-Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e

# Add this line to renew certificates twice daily
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## Step 13: Backup Setup

### 13.1 Create Backup Script
```bash
nano /home/flypick/backup.sh
```

**Add this content:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/flypick/backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -h localhost -U flypick_user flypick_production > $BACKUP_DIR/db_backup_$DATE.sql

# Backup media files
tar -czf $BACKUP_DIR/media_backup_$DATE.tar.gz /home/flypick/SIPI-Website/storage/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### 13.2 Make Backup Script Executable and Schedule
```bash
chmod +x /home/flypick/backup.sh

# Add to crontab for daily backups at 2 AM
crontab -e

# Add this line
0 2 * * * /home/flypick/backup.sh
```

---

## Step 14: Monitoring and Logs

### 14.1 View Application Logs
```bash
# Django application logs
sudo journalctl -u flypick -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### 14.2 Monitor System Resources
```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check running processes
htop
```

---

## Step 15: Final Verification Checklist

### 15.1 Verify All Components
- [ ] PostgreSQL database is running and accessible
- [ ] Django application is running on port 8000
- [ ] Nginx is running and serving both domains
- [ ] SSL certificates are installed and working
- [ ] Customer site loads at https://flypick.shop
- [ ] Seller dashboard loads at https://seller.flypick.shop
- [ ] Admin panel accessible at https://flypick.shop/admin/
- [ ] API endpoints respond correctly
- [ ] Email system is working
- [ ] File uploads work correctly
- [ ] All static files are served properly

### 15.2 Performance Test
```bash
# Test API response time
curl -w "@curl-format.txt" -o /dev/null -s https://flypick.shop/api/health/

# Create curl-format.txt
cat > curl-format.txt << EOF
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF
```

---

## Troubleshooting Common Issues

### Database Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log

# Test database connection
psql -h localhost -U flypick_user -d flypick_production
```

### Django Application Issues
```bash
# Check service status
sudo systemctl status flypick

# View application logs
sudo journalctl -u flypick -f

# Restart application
sudo systemctl restart flypick
```

### Nginx Issues
```bash
# Check nginx status
sudo systemctl status nginx

# Test nginx configuration
sudo nginx -t

# View nginx logs
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Test certificate renewal
sudo certbot renew --dry-run

# Check certificate expiration
openssl x509 -in /etc/letsencrypt/live/flypick.shop/fullchain.pem -noout -dates
```

---

## Maintenance Commands

### Regular Maintenance
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Restart all services
sudo systemctl restart postgresql nginx flypick

# Check service status
sudo systemctl status postgresql nginx flypick

# View disk usage
df -h

# Clean old logs
sudo journalctl --vacuum-time=30d
```

### Application Updates
```bash
# Pull latest code
cd /home/flypick/SIPI-Website
git pull origin main

# Update Python dependencies
cd server
source venv/bin/activate
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Rebuild frontend
cd ../client/Customer_site
npm install
npm run build

cd ../seller-side
npm install
npm run build

# Restart application
sudo systemctl restart flypick
```

---

## 🎉 Deployment Complete!

Your Flypick e-commerce platform is now manually deployed and running on:

- **Customer Site**: https://flypick.shop
- **Seller Dashboard**: https://seller.flypick.shop
- **Admin Panel**: https://flypick.shop/admin/

**Important**: Save this guide for future reference and maintenance tasks!