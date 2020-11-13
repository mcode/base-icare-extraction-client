const parse = require('csv-parse/lib/sync');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { logger } = require('mcode-extraction-framework');
const { sendEmailNotification, zipErrors } = require('mcode-extraction-framework');
const { extractDataForPatients } = require('mcode-extraction-framework');
const { RunInstanceLogger } = require('mcode-extraction-framework');
const { getMessagingClient, postExtractedData } = require('./icareFhirMessaging');

function getConfig(pathToConfig) {
  // Checks pathToConfig points to valid JSON file
  const fullPath = path.resolve(pathToConfig);
  try {
    return JSON.parse(fs.readFileSync(fullPath));
  } catch (err) {
    throw new Error(`The provided filepath to a configuration file ${pathToConfig}, full path ${fullPath} did not point to a valid JSON file.`);
  }
}

function checkInputAndConfig(config, fromDate, toDate) {
  // Check input args and needed config variables based on client being used
  const { patientIdCsvPath, awsConfig } = config;

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

function checkLogFile(pathToLogs) {
  // Check that the given log file exists
  try {
    const logFileContent = JSON.parse(fs.readFileSync(pathToLogs));
    if (!Array.isArray(logFileContent)) throw new Error('Log file needs to be an array.');
  } catch (err) {
    logger.error(`The provided filepath to a LogFile, ${pathToLogs}, did not point to a valid JSON file. Create a json file with an empty array at this location.`);
    throw new Error(err.message);
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

// TODO: There is a lot of overlap with this application and the mcode application,
// esp. when it comes to the configuration file helpers, log-file helpers and effective-date parsers;
// can improve later
async function icareApp(Client, fromDate, toDate, pathToConfig, pathToRunLogs, debug, allEntries) {
  try {
    if (debug) logger.level = 'debug';
    // Don't require a run-logs file if we are extracting all-entries. Only required when using --entries-filter.
    if (!allEntries) checkLogFile(pathToRunLogs);
    const config = getConfig(pathToConfig);
    checkInputAndConfig(config, fromDate, toDate);

    // Create and initialize client
    const icareClient = new Client(config);
    await icareClient.init();

    // Parse CSV for list of patient mrns
    const patientIdsCsvPath = path.resolve(config.patientIdCsvPath);
    const patientIds = parse(fs.readFileSync(patientIdsCsvPath, 'utf8'), { columns: true }).map((row) => row.mrn);

    // Get messaging client for messaging ICAREPlatform
    const messagingClient = getMessagingClient(config);

    // Get RunInstanceLogger for recording new runs and inferring dates from previous runs
    const runLogger = allEntries ? null : new RunInstanceLogger(pathToRunLogs);
    const effectiveFromDate = allEntries ? null : getEffectiveFromDate(fromDate, runLogger);
    const effectiveToDate = allEntries ? null : toDate;

    // Extract the data
    logger.info(`Extracting data for ${patientIds.length} patients`);
    const { extractedData, successfulExtraction, totalExtractionErrors } = await extractDataForPatients(patientIds, icareClient, effectiveFromDate, effectiveToDate);

    // Post the data using the messagingClient
    logger.info(`Posting data for ${patientIds.length} patients`);
    const { successfulMessagePost, messagingErrors } = await postExtractedData(messagingClient, extractedData);

    // If we have notification information, send an emailNotification
    const { notificationInfo } = config;
    if (notificationInfo) {
      const notificationErrors = zipErrors(totalExtractionErrors, messagingErrors);
      await sendEmailNotification(notificationInfo, notificationErrors, debug);
    }
    // A run is successful and should be logged when both extraction finishes without fatal errors
    // and messages are posted without fatal errors
    if (!allEntries && effectiveFromDate) {
      const successCondition = successfulExtraction && successfulMessagePost;
      if (successCondition) {
        runLogger.addRun(effectiveFromDate, effectiveToDate);
      }
    }
  } catch (e) {
    logger.error(e.message);
    logger.debug(e.stack);
    process.exit(1);
  }
}

module.exports = {
  icareApp,
};
