variable "name" {
  description = "String to use as name for objects"
  type        = string
}

variable "input_tags" {
  description = "Map of tags to apply to resources"
  type        = map(string)
  default = {
    Developer   = "StratusGrid"
    Provisioner = "Terraform"
  }
}

variable "cloudwatch_log_retention_days" {
  description = "Number of days for retention period of Lambda logs"
  type        = string
  default     = "30"
}

variable "timeout_sec" {
  description = "Number of seconds before Lambda times out"
  type        = number
  default     = 10
}

variable "memory_size" {
  description = "MB of memory function can use"
  type        = number
  default     = 128
}

variable "schedule_expression" {
  description = "Cron or Rate expression for how frequently the lambda should be executed by cloudwatch events"
  type        = string
  default     = "rate(1 hour)"
}

variable "subnet_ids" {
  description = "list of subnet ids that the lambda can attach to"
  type        = list(string)
  default     = []
}

variable "security_group_ids" {
  description = "list of security group ids which should be associated with lambda interfaces"
  type        = list(string)
  default     = []
}

variable "redis_targets" {
  description = "list of redis hostnames which should have their slowlog polled"
  type        = list(string)
}

variable "slowlog_get_limit" {
  description = "Number of slowlogs to get. Redis configures a buffer of 128 by default"
  type        = number
  default     = 128
}

variable "target_log_group" {
  description = "Name of log group to use as a destination for redis slowlogs"
  type        = string
}

variable "kms_log_key_deletion_window" {
  description = "Duration (in day) of kms key created, default is 30"
  type        = number
}
