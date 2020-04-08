# terraform-aws-lambda-redis-slowlog-to-cw-logs
This module will deploy a lambda function which will poll all redis_targets defined according to the schedule defined with schedule_expression

Areas Needing Improvement:
- Make logic for checking and selecting logs group better
- Make logic for checking and selecting logs stream better
- Organize and segment code better
- Better error handling

### Example Usage:
```
module "lambda_redis_slowlog_to_cw_logs_clustername" {
  source   = "StratusGrid/lambda-redis-slowlog-to-cw-logs/aws"
  version  = "1.0.0"
  # source   = "github.com/StratusGrid/terraform-aws-lambda-redis-slowlog-to-cw-logs"

  redis_targets = [
    "redis-cluster-001.yhglom.0001.use1.cache.amazonaws.com",
    "redis-cluster-1-002.yhglom.0001.use1.cache.amazonaws.com",
    "redis-cluster-1-003.yhglom.0001.use1.cache.amazonaws.com"
  ]
  name                = "${var.name_prefix}-redis-slowlog-to-cw-logs${local.name_suffix}"
  memory_size         = 128
  input_tags          = merge(local.common_tags, {})
  target_log_group    = "/aws/elasticache/redis/slowlogs" # This will be automatically created when ran if it doesn't already exist
  subnet_ids          = ["subnet-fjf4b1b","subnet-fgtyuc1e"]
  security_group_ids  = ["sg-fjusg9d32"] # Needs to be able to reach all redis targets and internet via NAT GW
  schedule_expression = "rate(1 minute)" # singular when 1, plural when >1
}
```

### Example Logs Enties:
With <<< descriptions
```
{
    "id": 609648,                 <<< unique ID of Cmd
    "timestamp": 1586322428,      <<< Timestamp in unix time
    "duration": 37459,            <<< Time in microseconds (so, 37.459 ms)
    "cmdArray": [                 <<< Cmd Array
        "GET",
        ":1:key:your-key"
    ],
    "client": "172.3.9.44:43150", <<< Client
    "clientName": ""              <<< Client frindly name (if set)
}
```