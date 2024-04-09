<!-- BEGIN_TF_DOCS -->
<p align="center">                                                                                                                                            
                                                                                
  <img src="https://github.com/StratusGrid/terraform-readme-template/blob/main/header/stratusgrid-logo-smaller.jpg?raw=true" />
  <p align="center">
    <a href="https://stratusgrid.com/book-a-consultation">Contact Us Test</a>
    <a href="https://stratusgrid.com/cloud-cost-optimization-dashboard">Stratusphere FinOps</a>
    <a href="https://stratusgrid.com">StratusGrid Home</a>
    <a href="https://stratusgrid.com/blog">Blog</a>
  </p>
</p>

# terraform-aws-lambda-redis-slowlog-to-cw-logs

GitHub: [StratusGrid/terraform-aws-lambda-redis-slowlog-to-cw-logs](https://github.com/StratusGrid/terraform-aws-lambda-redis-slowlog-to-cw-logs)

This module will deploy a lambda function which will poll all redis_targets defined according to the schedule defined with schedule_expression

### Areas Needing Improvement:
- Add a timeout for redis to connect (currently it just stays open till the function times out)
- Add server name as key in log object (can be used for metrics and filtering more easily this way)
- Make logic for checking and selecting logs group better
- Make logic for checking and selecting logs stream better
- Organize and segment code better
- Better error handling

## Example Usage:
```hcl
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
  subnet_ids          = ["subnet-00000","subnet-00000"]
  security_group_ids  = ["sg-00000"] # Needs to be able to reach all redis targets and internet via NAT GW
  schedule_expression = "rate(1 minute)" # singular when 1, plural when >1
}
```
---
### Example Logs Enties:
```hcl
{
    "id": 609648,                 <<< unique ID of Cmd
    "timestamp": 1586322428,      <<< Timestamp in unix time
    "duration": 37459,            <<< Time in microseconds (so, 37.459 ms)
    "cmdArray": [                 <<< Cmd Array
        "GET",
        ":1:key:your-key"
    ],
    "client": {
        "ip": "172.1.1.1",       <<< Client IP
        "port": "43696"           <<< Source Port for TCP Connection
    },
    "clientName": ""              <<< Client friendly name (if set)
}
```
---
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

## Resources

| Name | Type |
|------|------|
| [aws_cloudwatch_event_rule.event](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_rule) | resource |
| [aws_cloudwatch_event_target.function_target](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_target) | resource |
| [aws_cloudwatch_log_group.log_group](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_log_group) | resource |
| [aws_iam_role.function_role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role) | resource |
| [aws_iam_role_policy.function_policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy) | resource |
| [aws_iam_role_policy.function_policy_default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy) | resource |
| [aws_kms_key.log_key](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/kms_key) | resource |
| [aws_lambda_function.function](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function) | resource |
| [aws_lambda_permission.allow_cloudwatch_event_trigger](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_permission) | resource |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_cloudwatch_log_retention_days"></a> [cloudwatch\_log\_retention\_days](#input\_cloudwatch\_log\_retention\_days) | Number of days for retention period of Lambda logs | `string` | `"30"` | no |
| <a name="input_input_tags"></a> [input\_tags](#input\_input\_tags) | Map of tags to apply to resources | `map(string)` | <pre>{<br>  "Developer": "StratusGrid",<br>  "Provisioner": "Terraform"<br>}</pre> | no |
| <a name="input_kms_log_key_deletion_window"></a> [kms\_log\_key\_deletion\_window](#input\_kms\_log\_key\_deletion\_window) | Duration (in day) of kms key created, default is 30 | `number` | n/a | yes |
| <a name="input_memory_size"></a> [memory\_size](#input\_memory\_size) | MB of memory function can use | `number` | `128` | no |
| <a name="input_name"></a> [name](#input\_name) | String to use as name for objects | `string` | n/a | yes |
| <a name="input_redis_targets"></a> [redis\_targets](#input\_redis\_targets) | list of redis hostnames which should have their slowlog polled | `list(string)` | n/a | yes |
| <a name="input_schedule_expression"></a> [schedule\_expression](#input\_schedule\_expression) | Cron or Rate expression for how frequently the lambda should be executed by cloudwatch events | `string` | `"rate(1 hour)"` | no |
| <a name="input_security_group_ids"></a> [security\_group\_ids](#input\_security\_group\_ids) | list of security group ids which should be associated with lambda interfaces | `list(string)` | `[]` | no |
| <a name="input_slowlog_get_limit"></a> [slowlog\_get\_limit](#input\_slowlog\_get\_limit) | Number of slowlogs to get. Redis configures a buffer of 128 by default | `number` | `128` | no |
| <a name="input_subnet_ids"></a> [subnet\_ids](#input\_subnet\_ids) | list of subnet ids that the lambda can attach to | `list(string)` | `[]` | no |
| <a name="input_target_log_group"></a> [target\_log\_group](#input\_target\_log\_group) | Name of log group to use as a destination for redis slowlogs | `string` | n/a | yes |
| <a name="input_timeout_sec"></a> [timeout\_sec](#input\_timeout\_sec) | Number of seconds before Lambda times out | `number` | `10` | no |

## Outputs

No outputs.

---

<span style="color:red">Note:</span> Manual changes to the README will be overwritten when the documentation is updated. To update the documentation, run `terraform-docs -c .config/.terraform-docs.yml .`
<!-- END_TF_DOCS -->