#Event rule to direct events to the Lambda Function
resource "aws_cloudwatch_event_rule" "event" {
  name        = var.name
  description = "Pattern of events to forward to targets"

  schedule_expression = var.schedule_expression

}

#Target to direct event at function
resource "aws_cloudwatch_event_target" "function_target" {
  rule = aws_cloudwatch_event_rule.event.name
  target_id = var.name
  arn = aws_lambda_function.function.arn
}

#Permission to allow event trigger
resource "aws_lambda_permission" "allow_cloudwatch_event_trigger" {
  statement_id = "TrustCWEToInvokeMyLambdaFunction"
  action = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function.function_name
  principal = "events.amazonaws.com"
  source_arn = aws_cloudwatch_event_rule.event.arn
}

#Automatic packaging of code
data "archive_file" "function_code" {
  type = "zip"
  source_dir = "${path.module}/function_code"
  output_path = "${path.module}/function_code_zipped/function_code.zip"
}

#Function to process event
resource "aws_lambda_function" "function" {
  filename = data.archive_file.function_code.output_path
  source_code_hash = filebase64sha256(data.archive_file.function_code.output_path)
  function_name = var.name
  role = aws_iam_role.function_role.arn
  handler = "index.handler"
  runtime = "nodejs12.x"
  timeout = var.timeout_sec
  memory_size = var.memory_size
  environment {
    variables = {
      REDIS_TARGETS = join(",", var.redis_targets)
      TARGET_LOG_GROUP = var.target_log_group
      SLOWLOG_GET_LIMIT = var.slowlog_get_limit
    }
  }
  vpc_config {
    subnet_ids = var.subnet_ids
    security_group_ids = var.security_group_ids
  }
  lifecycle {
    ignore_changes = [last_modified]
  }
  tags = local.common_tags

}

#Role to attach policy to Function
resource "aws_iam_role" "function_role" {
  name = var.name
  tags = local.common_tags

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF

}

#Default policy for Lambda to be executed and put logs in Cloudwatch
resource "aws_iam_role_policy" "function_policy_default" {
name = "${var.name}-default-policy"
role = aws_iam_role.function_role.id

policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowListCloudWatchLogGroups",
      "Effect": "Allow",
      "Action": "logs:DescribeLogStreams",
      "Resource": "arn:aws:logs:${data.aws_region.current.name}:*:*"
    },
    {
      "Sid": "AllowCreatePutLogGroupsStreams",
      "Effect": "Allow",
      "Action": [
          "logs:PutLogEvents",
          "logs:CreateLogStream",
          "logs:CreateLogGroup"
      ],
      "Resource": [
          "arn:aws:logs:${data.aws_region.current.name}:*:log-group:/aws/lambda/${var.name}",
          "arn:aws:logs:${data.aws_region.current.name}:*:log-group:/aws/lambda/${var.name}:log-stream:*"
      ]
    },
    {
      "Sid": "AllowLambdaVPC",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*"
    }
  ]
}
EOF

}

#Policy for additional Permissions for Lambda Execution
resource "aws_iam_role_policy" "function_policy" {
name = var.name
role = aws_iam_role.function_role.id

policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowListCloudWatchLogGroups",
      "Effect": "Allow",
      "Action": "logs:Describe*",
      "Resource": "arn:aws:logs:${data.aws_region.current.name}:*:*"
    },
    {
      "Sid": "AllowCreatePutLogGroupsStreams",
      "Effect": "Allow",
      "Action": [
          "logs:PutLogEvents",
          "logs:CreateLogStream",
          "logs:CreateLogGroup"
      ],
      "Resource": [
          "arn:aws:logs:${data.aws_region.current.name}:*:log-group:${var.target_log_group}",
          "arn:aws:logs:${data.aws_region.current.name}:*:log-group:${var.target_log_group}:log-stream:*"
      ]
    }
  ]
}
EOF

}

#Cloudwatch Log Group for Function
resource "aws_cloudwatch_log_group" "log_group" {
  name = "/aws/lambda/${aws_lambda_function.function.function_name}"

  retention_in_days = var.cloudwatch_log_retention_days

  tags = local.common_tags
}

