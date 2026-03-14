# AWS Deployment Design

**Date:** 2026-03-14
**Repo:** https://github.com/pedrost/academic-search

## Overview

Deploy the full Hunter stack (Next.js app + BullMQ workers + Redis) to a single EC2 t2.small instance using Docker Compose, with SQLite replacing PostgreSQL for a lightweight embedded database.

## Infrastructure (Terraform)

| Resource | Spec | Notes |
|---|---|---|
| EC2 `t2.small` | 1 vCPU, 2GB RAM | user_data bootstraps the instance |
| EBS `gp3` 20GB | Attached to EC2 | Stores SQLite file at `/data/hunter.db` |
| Elastic IP | Static public IP | Survives instance stop/start |
| Security Group | Ports 22, 80, 443 inbound | 22 restricted to your IP |
| Key Pair | SSH access | Public key managed by Terraform |

No S3, no RDS, no ElastiCache, no IAM roles — intentionally minimal.

## Secrets / .env Handling

- `.env.production` lives locally alongside Terraform files, **never committed**
- Added to `.gitignore`: `terraform/.env.production`
- Terraform `file` provisioner uploads it to the EC2 instance at `/app/hunter/.env.production` during `terraform apply`

## Containers (Docker Compose)

3 services:

```
next-app   — Next.js app on port 3000
workers    — BullMQ workers with Playwright
redis      — redis:alpine, no persistence (--save "")
```

- `next-app` and `workers` share SQLite via bind mount: `/data/hunter.db`
- Nginx runs on the host (not containerized) as reverse proxy: port 80 → `next-app:3000`

## Database Migration: PostgreSQL → SQLite

Changes required:
1. `prisma/schema.prisma` — `provider = "sqlite"`, enums converted to `String`
2. `DATABASE_URL` — `file:/data/hunter.db`
3. `docker-compose.yml` — remove postgres service, add `/data` volume mount
4. Run `prisma migrate dev --name sqlite-migration`

No application code changes — all Prisma queries remain identical.

## Bootstrap Flow (user_data script)

On first EC2 boot:
1. Install Docker + Docker Compose
2. Format and mount EBS volume to `/data`
3. Install and configure Nginx (reverse proxy to port 3000)
4. Clone repo: `git clone https://github.com/pedrost/academic-search /app/hunter`
5. Copy `.env.production` (uploaded by Terraform file provisioner)
6. Run `docker compose up -d --build`

## Subsequent Deploys

```bash
ssh ec2-user@<EIP>
cd /app/hunter
git pull
docker compose up -d --build
```

## Memory Budget (t2.small, 2GB)

| Service | Idle | Active |
|---|---|---|
| OS + Docker | 300MB | 300MB |
| redis:alpine | 30MB | 30MB |
| next-app | 250MB | 250MB |
| workers (Playwright) | 50MB | 800MB |
| Nginx | 10MB | 10MB |
| **Total** | **640MB** | **1.39GB** |

Fits within 2GB even during active scraping.
