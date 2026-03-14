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
