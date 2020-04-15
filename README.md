# terraform-aws-lambda-redis-slowlog-to-cw-logs
This module will deploy a lambda function which will poll all redis_targets defined according to the schedule defined with schedule_expression

Areas Needing Improvement:
- Add a timeout for redis to connect (currently it just stays open till the function times out)
- Add server name as key in log object (can be used for metrics and filtering more easily this way)
- Make logic for checking and selecting logs group better
- Make logic for checking and selecting logs stream better
- Organize and segment code better
- Better error handling

### Example Usage:
```
module "lambda_redis_slowlog_to_cw_logs_clustername" {
  source   = "StratusGrid/lambda-redis-slowlog-to-cw-logs/aws"
  version  = "1.1.0"
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
    "client": {
        "ip": "172.3.9.44",       <<< Client IP
        "port": "43696"           <<< Source Port for TCP Connection
    },
    "clientName": ""              <<< Client frindly name (if set)
}
```

### Example Logs Insights Queries:
Count of slow logs per minute:
```
stats count(*) as count by bin(1m)
```

Count of slowlog entries per unique query:
```
stats count(*) as count by cmdArray.0,cmdArray.1
```

Count of slowlog entries per minute for a specific key:
```
filter cmdArray.1 like /my-key-name/
| stats count(*) as count by bin (60s)
```

Sort slowlog entries by duration, slowest at the top:
```
sort by duration desc
```

Average duration of requests per key for time period:
```
stats avg(duration) as avg by cmdArray.0,cmdArray.1 | sort by avg desc
```

Total time spent in slowlog entries for all servers for time period by key:
```
stats sum(duration) as sum by cmdArray.0,cmdArray.1 | sort by sum desc
```

Total time spent per monitored server for time period:
```
stats sum(duration) by @logStream
```