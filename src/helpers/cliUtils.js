const parse = require('csv-parse/lib/sync');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const MessagingClient = require('fhir-messaging-client');
const { logger } = require('mcode-extraction-framework');
const { RunInstanceLogger } = require('../RunInstanceLogger');
const { getResourceCountInBundle } = require('../icareBundling');

// Check input args and needed config variables based on client being used
function checkConfig(config, fromDate, toDate) {
  const { awsConfig, patientIdCsvPath } = config;

  // Check if `fromDate` is a valid date
  if (fromDate && !moment(fromDate).isValid()) {
    throw new Error('-f/--from-date is not a valid date.');
  }

  // Check if `toDate` is a valid date
  if (toDate && !moment(toDate).isValid()) {
    throw new Error('-t/--to-date is not a valid date.');
  }

  // Check if there is a path to the MRN CSV and a path to the AWS config within our config file
  if (!awsConfig || !patientIdCsvPath) {
    throw new Error('patientIdCsvPath, awsConfig are required in config file');
  }
}

// Check log file exists
function checkLogFile(pathToLogs) {
  try {
    const logFileContent = JSON.parse(fs.readFileSync(pathToLogs));
    if (!Array.isArray(logFileContent)) throw new Error('Log file needs to be an array.');
  } catch (err) {
    logger.error(`-l/--path-to-run-logs value of ${pathToLogs} did not point to a valid JSON file. Create a json file with an empty array.`);
    throw new Error(err.message);
  }
}

// Check messagingClient can send message and authorize
async function checkMessagingClient(messagingClient) {
  try {
    if (!(await messagingClient.canSendMessage())) {
      throw new Error('The server does not provide the "system/$process-message" scope.');
    }
  } catch (e) {
    throw new Error(e.message);
  }

  try {
    await messagingClient.authorize();
  } catch (e) {
    throw new Error(`Could not authorize messaging client - ${e.message}`);
  }
}

// Checks pathToConfig points to valid JSON file
function getConfig(pathToConfig) {
  const fullPath = path.resolve(pathToConfig);
  try {
    return JSON.parse(fs.readFileSync(fullPath));
  } catch (err) {
    throw new Error(`-p/--path-to-config value of ${pathToConfig}, full path ${fullPath} did not point to a valid JSON file.`);
  }
}

// Use previous runs to infer a valid fromDate if none was provided
function getEffectiveFromDate(fromDate, runLogger) {
  if (fromDate) return fromDate;

  // Use the most recent ToDate
  logger.info('No fromDate was provided, inferring an effectiveFromDate');
  const effectiveFromDate = runLogger.getMostRecentToDate();
  logger.info(`effectiveFromDate: ${effectiveFromDate}`);
  if (!effectiveFromDate) {
    throw new Error('no valid fromDate was supplied, and there are no log records from which we could pull a fromDate');
  }

  return effectiveFromDate;
}

async function extractDataForPatients(auth, config, patientIds, icareClient, messagingClient, runLogger, effectiveFromDate, toDate) {
  if (auth) {
    await icareClient.initAuth(config.auth);
  }

  await checkMessagingClient(messagingClient);

  /* eslint-disable no-restricted-syntax */
  /* eslint-disable no-await-in-loop */
  // Track if these runs were successful; if not, don't log a new RunInstance
  let successfulRun = true;
  for (const [index, mrn] of patientIds.entries()) {
    try {
      logger.info(`Extracting information for patient at row ${index + 1} in .csv file`);
      const response = await icareClient.get({ mrn, fromDate: effectiveFromDate, toDate });
      const resourceCount = getResourceCountInBundle(response);
      logger.info(`Resources extracted for patient ${index + 1} in .csv file`);
      Object.keys(resourceCount).forEach((resourceType) => logger.info(`${resourceType}: ${resourceCount[resourceType]} extracted`));
      try {
        await messagingClient.processMessage(response);
        logger.info(`SUCCESS - sent message for patient at row ${index + 1}`);
      } catch (e) {
        successfulRun = false;
        const violation = JSON.parse(e.response.data.errorMessage);
        const violationText = violation.entry[1].resource.issue.details.text;
        logger.error(`ERROR - could not send message for patient at row ${index + 1} - ${e.message} - ${violationText}`);
        logger.debug(e.stack);
      }
    } catch (err) {
      successfulRun = false;
      logger.error(`Error extracting data: ${err.message}`);
      logger.debug(err.stack);
    }
  }

  if (successfulRun) {
    logger.info('Logging successful run information to records');
    runLogger.addRun(effectiveFromDate, toDate);
  }
}

async function app(Client, fromDate, toDate, pathToConfig, pathToRunLogs, debug, auth) {
  try {
    if (debug) logger.level = 'debug';
    checkLogFile(pathToRunLogs);
    const config = getConfig(pathToConfig);
    checkConfig(config, fromDate, toDate);
    const icareClient = new Client(config);

    // Parse CSV for list of patient mrns
    const patientIdsCsvPath = path.resolve(config.patientIdCsvPath);
    const patientIds = parse(fs.readFileSync(patientIdsCsvPath, 'utf8'), { columns: true }).map((row) => row.mrn);
    // Get messaging client for messaging ICAREPlatform
    const messagingClient = new MessagingClient(config.awsConfig);
    // Get RunInstanceLogger for recording new runs and inferring dates from previous runs
    const runLogger = new RunInstanceLogger(pathToRunLogs);
    const effectiveFromDate = getEffectiveFromDate(fromDate, runLogger);

    logger.info(`Extracting data for ${patientIds.length} patients`);
    await extractDataForPatients(auth, config, patientIds, icareClient, messagingClient, runLogger, effectiveFromDate, toDate);
  } catch (e) {
    logger.error(e.message);
    logger.debug(e.stack);
    process.exit(1);
  }
}

module.exports = {
  app,
};
