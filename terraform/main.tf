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
    cidr_blocks = ["0.0.0.0/0"]
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
