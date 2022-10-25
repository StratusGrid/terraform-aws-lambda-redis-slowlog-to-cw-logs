locals {
  common_tags = merge(var.input_tags, {
    "ModuleSourceRepo" = "https://github.com/StratusGrid/terraform-aws-lambda-redis-slowlog-to-cw-logs"
  })
}