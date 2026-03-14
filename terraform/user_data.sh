#!/bin/bash
set -e

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl enable docker
systemctl start docker

# Install Docker Compose
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Add ec2-user to docker group
usermod -aG docker ec2-user

# Create /data directory for SQLite
mkdir -p /data

# Install Nginx
yum install -y nginx

# Configure Nginx as reverse proxy
cat > /etc/nginx/conf.d/hunter.conf << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

systemctl enable nginx
systemctl start nginx

# Clone repository
mkdir -p /app
git clone https://github.com/pedrost/academic-search /app/hunter

# Create .env.production placeholder (will be overwritten by Terraform file provisioner)
touch /app/hunter/.env.production

# Set permissions so ec2-user can write
chown -R ec2-user:ec2-user /app/hunter
chown -R ec2-user:ec2-user /data
