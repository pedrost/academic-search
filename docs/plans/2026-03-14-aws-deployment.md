# AWS Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy Hunter (Next.js + BullMQ workers + Redis) to a single EC2 t2.small using Docker Compose and SQLite, provisioned by Terraform.

**Architecture:** Single EC2 instance running 3 Docker containers (`next-app`, `workers`, `redis:alpine`) orchestrated by Docker Compose. SQLite on an EBS volume replaces PostgreSQL. Nginx runs on the host as a reverse proxy. Terraform provisions all AWS infrastructure and uploads `.env.production` via file provisioner.

**Tech Stack:** Terraform, Docker Compose, Prisma SQLite, Nginx, AWS EC2/EBS/EIP

---

## Task 1: Update .gitignore

**Files:**
- Modify: `.gitignore`
- Create: `terraform/.gitignore`

**Step 1: Add terraform env file to root .gitignore**

Append to `.gitignore`:
```
# Terraform secrets
terraform/.env.production
terraform/.terraform/
terraform/terraform.tfstate
terraform/terraform.tfstate.backup
terraform/*.tfvars
```

**Step 2: Create terraform/.gitignore**

Create `terraform/.gitignore`:
```
.env.production
.terraform/
terraform.tfstate
terraform.tfstate.backup
*.tfvars
```

**Step 3: Commit**
```bash
git add .gitignore terraform/.gitignore
git commit -m "chore: add gitignore rules for terraform secrets"
```

---

## Task 2: Migrate Prisma Schema to SQLite

**Files:**
- Modify: `prisma/schema.prisma`

**Context:** SQLite via Prisma does not support `String[]` arrays. The `keywords` field on `Dissertation` must change to `Json`. All enum types are supported — Prisma stores them as TEXT in SQLite. The `@prisma/adapter-pg` is not used with SQLite.

**Step 1: Update datasource provider**

In `prisma/schema.prisma`, change:
```prisma
datasource db {
  provider = "postgresql"
}
```
To:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Step 2: Change keywords field type**

In the `Dissertation` model, change:
```prisma
keywords     String[]
```
To:
```prisma
keywords     Json     @default("[]")
```

**Step 3: Verify schema compiles**
```bash
npx prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid`

**Step 4: Commit**
```bash
git add prisma/schema.prisma
git commit -m "feat: migrate prisma schema to sqlite"
```

---

## Task 3: Update Prisma DB Client

**Files:**
- Modify: `src/lib/db/index.ts`

**Context:** The current client uses `PrismaPg` adapter which is PostgreSQL-specific. SQLite uses the default Prisma client with no adapter.

**Step 1: Replace the file contents**

Replace `src/lib/db/index.ts` with:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Step 2: Remove unused pg adapter dependency usage**

Check if `@prisma/adapter-pg` is used anywhere else:
```bash
grep -r "adapter-pg\|PrismaPg" src/ --include="*.ts"
```
Expected: no output. If found, remove those usages too.

**Step 3: Commit**
```bash
git add src/lib/db/index.ts
git commit -m "feat: switch prisma client to sqlite (remove pg adapter)"
```

---

## Task 4: Fix keywords Type in academic-upsert.ts

**Files:**
- Modify: `src/lib/academic-upsert.ts`

**Context:** With `keywords Json`, Prisma returns `Prisma.JsonValue` (not `string[]`). We need to cast at read points and ensure writes pass arrays (Prisma serializes them automatically).

**Step 1: Add cast helper at top of file**

After imports, add:
```typescript
const asStringArray = (v: unknown): string[] => (Array.isArray(v) ? v as string[] : [])
```

**Step 2: Fix read of existing.keywords**

Find the keywords merge block (around line 225):
```typescript
const existingKeywords = new Set(existing.keywords)
const newKeywords = data.keywords.filter(k => !existingKeywords.has(k))
  updates.keywords = [...existing.keywords, ...newKeywords]
```
Replace with:
```typescript
const existingKeywords = new Set(asStringArray(existing.keywords))
const newKeywords = data.keywords!.filter(k => !existingKeywords.has(k))
updates.keywords = [...asStringArray(existing.keywords), ...newKeywords]
```

**Step 3: Commit**
```bash
git add src/lib/academic-upsert.ts
git commit -m "fix: cast keywords Json to string[] in academic-upsert"
```

---

## Task 5: Fix keywords Type in All Scrapers and Services

**Files:**
- Modify: `src/lib/scrapers/sucupira.ts`
- Modify: `src/lib/scrapers/linkedin.ts`
- Modify: `src/services/scrapers/bdtd-scraper.ts`
- Modify: `src/services/scrapers/sucupira-scraper.ts`
- Modify: `src/services/scrapers/ufms-scraper.ts`
- Modify: `src/lib/db/academics.ts`
- Modify: `src/app/api/import-xls/route.ts`

**Context:** Any place that reads `dissertation.keywords` now returns `Prisma.JsonValue`. Writes (passing `string[]`) work fine — Prisma serializes automatically. Only read access needs casts.

**Step 1: Find all read access points**
```bash
grep -n "\.keywords" src/ -r --include="*.ts"
```

**Step 2: For each file that reads keywords into a string[] context, add a cast**

Pattern — replace:
```typescript
dissertation.keywords
// or
item.keywords
```
With:
```typescript
(dissertation.keywords as string[])
// or
(item.keywords as string[])
```

Only needed where the value is used as `string[]` (e.g. spread, `.map()`, `.filter()`, `Set()`). Writes that pass `string[]` literals need no changes.

**Step 3: Verify TypeScript compiles**
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 4: Commit**
```bash
git add src/
git commit -m "fix: cast keywords Json to string[] across scrapers and services"
```

---

## Task 6: Run SQLite Migration

**Files:**
- Creates: `prisma/migrations/*/migration.sql`

**Step 1: Set local DATABASE_URL for SQLite**

Create or update `.env.local` (gitignored):
```env
DATABASE_URL="file:./data/hunter.db"
```
Create the data directory:
```bash
mkdir -p data
echo "data/*.db" >> .gitignore
```

**Step 2: Run migration**
```bash
npx prisma migrate dev --name sqlite-migration
```
Expected: `Your database is now in sync with your schema.`

**Step 3: Verify Prisma client generates correctly**
```bash
npx prisma generate
```
Expected: `Generated Prisma Client`

**Step 4: Commit**
```bash
git add prisma/migrations/ .gitignore
git commit -m "feat: add sqlite migration"
```

---

## Task 7: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`
- Create: `.dockerignore`

**Step 1: Replace docker-compose.yml**

```yaml
services:
  next-app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env.production
    volumes:
      - /data:/data
    ports:
      - "3000:3000"
    depends_on:
      - redis

  workers:
    build:
      context: .
      dockerfile: Dockerfile.workers
    restart: unless-stopped
    env_file: .env.production
    volumes:
      - /data:/data
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --save "" --loglevel warning
```

**Step 2: Create .dockerignore**

```
node_modules
.next
data/
.env*
*.md
screenshots/
docs/
terraform/
prisma/migrations/
.git
```

**Step 3: Commit**
```bash
git add docker-compose.yml .dockerignore
git commit -m "feat: update docker-compose for production (sqlite + 3 services)"
```

---

## Task 8: Create Dockerfile for next-app

**Files:**
- Create: `Dockerfile`

**Context:** Multi-stage build to keep image small. Runs `prisma migrate deploy` at startup to apply migrations against the SQLite file on the EBS volume.

**Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

**Step 2: Enable Next.js standalone output**

In `next.config.ts`, add `output: 'standalone'` to the config object:
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  // ... existing config
}
```

**Step 3: Commit**
```bash
git add Dockerfile next.config.ts
git commit -m "feat: add dockerfile for next-app with standalone output"
```

---

## Task 9: Create Dockerfile.workers

**Files:**
- Create: `Dockerfile.workers`

**Context:** Workers use Playwright which requires system dependencies (glibc, chromium libs). Must use `node:20-bookworm` (Debian), not Alpine. Playwright installs its own Chromium.

**Step 1: Create Dockerfile.workers**

```dockerfile
FROM node:20-bookworm-slim
WORKDIR /app

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libexpat1 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0

COPY package*.json ./
RUN npm ci

RUN npx playwright install chromium

COPY . .
RUN npx prisma generate

CMD ["npx", "tsx", "src/workers/index.ts"]
```

**Step 2: Commit**
```bash
git add Dockerfile.workers
git commit -m "feat: add dockerfile for workers with playwright deps"
```

---

## Task 10: Create Terraform Configuration

**Files:**
- Create: `terraform/main.tf`
- Create: `terraform/variables.tf`
- Create: `terraform/outputs.tf`

**Step 1: Create terraform/variables.tf**

```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t2.small"
}

variable "public_key_path" {
  description = "Path to your SSH public key"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "private_key_path" {
  description = "Path to your SSH private key (for provisioner)"
  type        = string
  default     = "~/.ssh/id_rsa"
}

variable "your_ip" {
  description = "Your IP for SSH access (e.g. 1.2.3.4/32)"
  type        = string
}
```

**Step 2: Create terraform/main.tf**

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# --- Key Pair ---
resource "aws_key_pair" "hunter" {
  key_name   = "hunter-key"
  public_key = file(var.public_key_path)
}

# --- Security Group ---
resource "aws_security_group" "hunter" {
  name        = "hunter-sg"
  description = "Hunter app security group"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.your_ip]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- EC2 Instance ---
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

resource "aws_instance" "hunter" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.hunter.key_name
  vpc_security_group_ids = [aws_security_group.hunter.id]

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  user_data = file("${path.module}/user_data.sh")

  tags = {
    Name = "hunter-app"
  }
}

# --- Elastic IP ---
resource "aws_eip" "hunter" {
  instance = aws_instance.hunter.id
  domain   = "vpc"
}

# --- Upload .env.production and start app ---
resource "null_resource" "deploy" {
  depends_on = [aws_eip.hunter]

  connection {
    type        = "ssh"
    user        = "ec2-user"
    private_key = file(var.private_key_path)
    host        = aws_eip.hunter.public_ip
  }

  # Wait for user_data to finish installing Docker
  provisioner "remote-exec" {
    inline = [
      "until [ -f /var/lib/cloud/instance/boot-finished ]; do sleep 5; done",
      "until docker info > /dev/null 2>&1; do sleep 5; done"
    ]
  }

  # Upload .env.production
  provisioner "file" {
    source      = "${path.module}/.env.production"
    destination = "/app/hunter/.env.production"
  }

  # Start the app
  provisioner "remote-exec" {
    inline = [
      "cd /app/hunter",
      "docker compose up -d --build"
    ]
  }
}
```

**Step 3: Create terraform/outputs.tf**

```hcl
output "instance_ip" {
  description = "Elastic IP of the Hunter instance"
  value       = aws_eip.hunter.public_ip
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh ec2-user@${aws_eip.hunter.public_ip}"
}

output "app_url" {
  description = "App URL"
  value       = "http://${aws_eip.hunter.public_ip}"
}
```

**Step 4: Commit**
```bash
git add terraform/main.tf terraform/variables.tf terraform/outputs.tf
git commit -m "feat: add terraform infrastructure configuration"
```

---

## Task 11: Create user_data.sh Bootstrap Script

**Files:**
- Create: `terraform/user_data.sh`

**Step 1: Create terraform/user_data.sh**

```bash
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

# Format and mount EBS root volume data partition
# SQLite will live at /data/hunter.db
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
```

**Step 2: Commit**
```bash
git add terraform/user_data.sh
git commit -m "feat: add ec2 user_data bootstrap script"
```

---

## Task 12: Create .env.production Template

**Files:**
- Create: `terraform/.env.production.example`

**Context:** The actual `.env.production` is gitignored. This example shows what's needed.

**Step 1: Create terraform/.env.production.example**

```env
# Copy this to terraform/.env.production and fill in values
DATABASE_URL="file:/data/hunter.db"
REDIS_URL="redis://redis:6379"

# Add any other env vars your app needs (API keys, etc.)
# GROK_API_KEY=
# OPENAI_API_KEY=
```

**Step 2: Commit**
```bash
git add terraform/.env.production.example
git commit -m "docs: add .env.production example for terraform deployment"
```

---

## Task 13: Verify Build Locally

**Step 1: Generate Prisma client for SQLite**
```bash
DATABASE_URL="file:./data/hunter.db" npx prisma generate
```

**Step 2: Run TypeScript check**
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Test Docker build (next-app)**
```bash
docker build -t hunter-app .
```
Expected: successfully built

**Step 4: Test Docker build (workers)**
```bash
docker build -f Dockerfile.workers -t hunter-workers .
```
Expected: successfully built (will take a while — Playwright downloads Chromium)

**Step 5: Commit any fixes found during build**
```bash
git add -p
git commit -m "fix: resolve build issues found during docker verification"
```

---

## Task 14: Deploy with Terraform

**Prerequisites:**
- AWS CLI configured (`aws configure`)
- SSH key pair exists at `~/.ssh/id_rsa` and `~/.ssh/id_rsa.pub`
- `terraform/.env.production` created and filled in

**Step 1: Initialize Terraform**
```bash
cd terraform
terraform init
```

**Step 2: Plan deployment**
```bash
terraform plan -var="your_ip=$(curl -s ifconfig.me)/32"
```
Review the plan — should show ~5 resources to create.

**Step 3: Apply**
```bash
terraform apply -var="your_ip=$(curl -s ifconfig.me)/32"
```
Type `yes` when prompted. Takes ~3-5 minutes (EC2 boot + Docker build).

**Step 4: Verify**
```bash
# Terraform outputs the app URL
# Visit http://<EIP> in browser
```

**Step 5: SSH in and check logs if needed**
```bash
ssh ec2-user@<EIP>
cd /app/hunter
docker compose logs -f
```

---

## Subsequent Deploys

```bash
ssh ec2-user@<EIP>
cd /app/hunter
git pull
docker compose up -d --build
```
