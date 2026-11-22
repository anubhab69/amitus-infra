# 🚀 Production Deployment Guide
### Real Estate & Construction Multi-Site Inventory System

This application is built with **zero external dependencies** using native Node.js. It requires **no build step**, starts in 50 milliseconds, and can be deployed anywhere from free cloud hosting to private office servers.

---

## 📱 Mobile App Setup for Your Father (iPhone / Android)
Once deployed to any public URL (e.g. `https://inventory.yourcompany.com` or `https://your-app.onrender.com`):
1. Open the URL in **Safari** (iPhone) or **Chrome** (Android).
2. Tap the **Share / Menu** icon (square with arrow up on iOS, 3 dots on Android).
3. Tap **"Add to Home Screen"**.
4. An app icon named **"Site Inventory"** will appear on his phone's home screen.
5. He can now open it with a single tap like a native mobile app from any construction site!

---

## 🌐 Option 1: 1-Click Free Cloud Hosting (Render / Railway) — *Most Recommended*
Best for fast 24/7 access from construction sites with free HTTPS and zero server maintenance.

### Deploying to Render.com (Free Tier):
1. Push this folder to a GitHub repository (e.g. `github.com/your-username/inventory-management`).
2. Sign up / Log in to [Render.com](https://render.com).
3. Click **"New +"** ➜ **"Web Service"**.
4. Connect your GitHub repository.
5. Configure the settings:
   - **Name**: `company-inventory`
   - **Environment**: `Node`
   - **Build Command**: *(leave blank or `npm run start`)*
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
6. Under **Environment Variables**, add:
   - `ADMIN_USER`: `father` *(or your chosen username)*
   - `ADMIN_PASSWORD`: `your-secure-password` *(protects the site from unauthorized visitors)*
   - `PORT`: `3000`
7. Click **"Create Web Service"**.
8. Within 2 minutes, you will get a live secure URL: `https://company-inventory.onrender.com`.
9. *(Optional)* Under **Custom Domains**, you can attach your own domain: `inventory.yourcompany.com`.

---

## 🖥️ Option 2: Private Cloud VPS (DigitalOcean / AWS EC2 / Hetzner / Linode)
Best if you have a dedicated server with your company domain name.

### 1. Upload files to server
```bash
scp -r * user@your-server-ip:/var/www/inventory/
```

### 2. Install PM2 (Process Manager for 24/7 background uptime)
```bash
ssh user@your-server-ip
cd /var/www/inventory
sudo npm install -g pm2
pm2 start pm2.config.js
pm2 save
pm2 startup
```

### 3. Setup Nginx Reverse Proxy with Free SSL
Create `/etc/nginx/sites-available/inventory`:
```nginx
server {
    server_name inventory.yourcompany.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```
Enable the site and install SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d inventory.yourcompany.com
```

### 4. Enable Automated Daily Database Backups
Add a nightly cron job at 2:00 AM:
```bash
crontab -e
# Add this line:
0 2 * * * /var/www/inventory/backup.sh > /dev/null 2>&1
```

---

## 🔒 Option 3: Office Local Server with Cloudflare Tunnel (Zero Cost & Private)
If you want to keep the data physically on a computer in your father's office, but still allow him to access it on his phone:

1. Install **Cloudflare Tunnel** (`cloudflared`):
   ```bash
   brew install cloudflared  # On Mac
   ```
2. Run a tunnel directly to your local server:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. Cloudflare will give you an instant, secure public HTTPS address (e.g. `https://random-name.trycloudflare.com`) that your father can open from anywhere without opening any router ports!

---

## 🐳 Option 4: Docker Container Deployment
If using Docker or AWS ECS:

```bash
# Build the container image
docker build -t construction-inventory .

# Run with persistent volume mount for data
docker run -d \
  -p 3000:3000 \
  -e ADMIN_USER=admin \
  -e ADMIN_PASSWORD=supersecret \
  -v $(pwd)/data:/app/data \
  --restart always \
  --name inventory \
  construction-inventory
```

---

## 🔐 Built-In Security Settings
When deploying publicly, protect your site by setting the following environment variables:
- `ADMIN_USER`: Username for login (default: `admin`)
- `ADMIN_PASSWORD`: Your secret password
- When set, any browser opening the site will prompt for this username and password before granting access. If left unset (in local development), it opens freely.
