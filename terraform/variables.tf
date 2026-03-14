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
