"use strict";

// import redis
const redis = require("redis");

// import Cloudwatch Logs and instantiate
const CloudWatchLogs = require("aws-sdk/clients/cloudwatchlogs");
var cloudwatchlogs = new CloudWatchLogs({
  apiVersion: "2014-03-28",
  region: process.env.AWS_REGION,
});

// get target log group to use as a destination for slowlog streams
const logGroupName = process.env.TARGET_LOG_GROUP;

// splits a comma separated string var into a list of redis hosts
const redisTargets = process.env.REDIS_TARGETS.split(",");

// Gets the limit to the number of slowlogs returned
const slowlogGetLimit = process.env.SLOWLOG_GET_LIMIT;

// sleep function can be used with await to cause a function to pause for x ms
// this is used to wait for cloudwatch on the creation of new resources
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// asyncForEach is used to prevent lambda from resolving before operations are completed on every item in array
// may be worth converting this to a promise all later
async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

// getSlowlogs returns a promise, then gets all slowlogs, then maps them to an array of objects and returns the array.
let getSlowlogs = async (client, maxAge, slowlogGetLimit) => {
  return new Promise((resolve, reject) => {
    // promise wrapper needed because node-redis does not support promises natively yet.
    client.slowlog(["get", String(slowlogGetLimit)], async function (err, res) {
      // get the most recent 128 slowlogs (128 is the default)
      if (err) {
        reject(err);
      }

      // build an array with all entries newer than the maxAge variable
      let filteredObjectsArray = [];
      await asyncForEach(res, async (slowlogArray) => {
        if (slowlogArray[1] >= maxAge) {
          // break client into an object with ip and port keys
          let clientRegexGrouper = /(?<ip>.*?):(?<port>.*)/;
          const clientKeys = slowlogArray[4].match(clientRegexGrouper);
          const clientObject = {
            ip: clientKeys.groups.ip,
            port: clientKeys.groups.port,
          };

          // create an object with all fields and push it into the array
          filteredObjectsArray.push({
            id: slowlogArray[0],
            timestamp: slowlogArray[1],
            duration: slowlogArray[2],
            cmdArray: slowlogArray[3],
            client: clientObject,
            clientName: slowlogArray[5],
          });
        }
        // if it's older than maxAge, log it to the lambda cloudwatch logs
        else {
          console.log("TimeStamp too old for CloudWatch Logs Batch:");
          console.log({
            id: slowlogArray[0],
            timestamp: slowlogArray[1],
            duration: slowlogArray[2],
            cmdArray: slowlogArray[3],
            client: slowlogArray[4],
            clientName: slowlogArray[5],
          });
        }
      });
      // return the completed array
      resolve(filteredObjectsArray);
    });
  });
};

exports.handler = async function (event, context, callback) {
  //eslint-disable-line

  // cloudwatch logs require you to submit no more than 24hr in a single batch, we cut 60sec off of that as a margin
  const cloudwatchLogCutoffTimestamp = Math.round(
    (new Date().getTime() - 24 * 60 * 60 * 1000) / 1000 - 60,
  );

  await asyncForEach(redisTargets, async (redisTarget) => {
    // initialize the client
    const redisUrl = "redis://" + redisTarget + ":6379";
    console.log("Connecting to: " + redisUrl);
    const client = redis.createClient(redisUrl);

    client.on("error", function (error) {
      console.error(error);
    });

    // get the array of slowlog entry objects from redis
    let slowLogs = null;
    try {
      slowLogs = await getSlowlogs(
        client,
        cloudwatchLogCutoffTimestamp,
        slowlogGetLimit,
      );
      console.log(
        "Retrieved " + slowLogs.length + " slowlog entries from " + redisUrl,
      );
    } catch {
      console.log("Failed to retrieve slowlog entries from " + redisUrl);
      return Promise.reject(err);
    }

    // check to see if log group exists
    var params = {
      limit: "1",
      logGroupNamePrefix: logGroupName,
    };
    const logGroups = await cloudwatchlogs.describeLogGroups(params).promise();

    // if no log group, create a new one
    if (logGroups.logGroups.length <= 0) {
      console.log("Creating Log Group: " + logGroupName);
      var params = {
        logGroupName: logGroupName /* required */,
        // tags: {
        //   '<TagKey>': 'STRING_VALUE',
        //   /* '<TagKey>': ... */
        // }
      };
      const logGroupResult = await cloudwatchlogs
        .createLogGroup(params)
        .promise();
    }

    // check to see if the log stream exists
    var params = {
      logGroupName: logGroupName /* required */,
      descending: true || false,
      limit: "1",
      logStreamNamePrefix: redisTarget,
      orderBy: "LogStreamName",
    };
    const logStreams = await cloudwatchlogs
      .describeLogStreams(params)
      .promise();

    // if no log stream, create a new one
    if (logStreams.logStreams.length <= 0) {
      console.log("Creating Log Stream: " + logGroupName + "/" + redisTarget);
      var params = {
        logGroupName: logGroupName /* required */,
        logStreamName: redisTarget /* required */,
      };
      const logStreamResult = await cloudwatchlogs
        .createLogStream(params)
        .promise();
      // then pull the log stream again after giving cloudwatch logs time to catch up
      await sleep(2000);
      const logStreams = await cloudwatchlogs
        .describeLogStreams(params)
        .promise();
    }

    // Only try to push logs if you have logs to push
    if (slowLogs.length > 0) {
      // sort logs by timestamp (required)
      slowLogs.sort(function (a, b) {
        return a.timestamp - b.timestamp;
      });
      // build initial params
      var params = {
        logEvents: slowLogs.map((log) => {
          return {
            message: JSON.stringify(log),
            timestamp: log.timestamp * 1000,
          };
        }),
        logGroupName: logGroupName /* required */,
        logStreamName: redisTarget /* required */,
        // sequenceToken: 'STRING_VALUE'
      };
      // if there is a sequence token on the log stream, add it to the param
      if (logStreams.logStreams[0].uploadSequenceToken !== undefined) {
        params["sequenceToken"] = logStreams.logStreams[0].uploadSequenceToken;
      }
      // put logs
      console.log(
        "Attempting to put " +
          params.logEvents.length +
          " slowlogs into " +
          logGroupName +
          "/" +
          redisTarget,
      );
      const putLogsResult = await cloudwatchlogs.putLogEvents(params).promise();
      console.log(putLogsResult);

      // send slowlog reset to clear slowlog entries from memory (so the next run won't return the same ones)
      client.slowlog("reset", function (err, res) {
        console.log(res);
        console.log("Successfully reset slowlog for " + redisUrl);
      });
    }
    // otherwise log that there were no logs which satisfied constraints
    else {
      console.log("No new slowlog entries since last run");
    }

    // close the client connection
    client.quit(function (err, res) {
      console.log("Disconnecting from " + redisUrl + " with quit command");
    });
  });

  callback(null, "success"); // return success in proper format for api gw
};
