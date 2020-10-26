const parse = require('csv-parse/lib/sync');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { logger } = require('mcode-extraction-framework');
const { RunInstanceLogger } = require('../RunInstanceLogger');
const { getResourceCountInBundle } = require('./icareBundling');
const { sendEmailNotification } = require('./emailUtils');
const { getMessagingClient, postExtractedData } = require('./fhirMessagingUtils');

// Checks pathToConfig points to valid JSON file
function getConfig(pathToConfig) {
  const fullPath = path.resolve(pathToConfig);
  try {
    return JSON.parse(fs.readFileSync(fullPath));
  } catch (err) {
    throw new Error(`he provided filepath to a configuration file ${pathToConfig}, full path ${fullPath} did not point to a valid JSON file.`);
  }
}

// Check input args and needed config variables based on client being used
function checkInputAndConfig(config, fromDate, toDate) {
  const { patientIdCsvPath } = config;

  // Check if `fromDate` is a valid date
  if (fromDate && !moment(fromDate).isValid()) {
    throw new Error('-f/--from-date is not a valid date.');
  }

  // Check if `toDate` is a valid date
  if (toDate && !moment(toDate).isValid()) {
    throw new Error('-t/--to-date is not a valid date.');
  }

  // Check if there is a path to the MRN CSV within our config JSON
  if (!patientIdCsvPath) {
    throw new Error('patientIdCsvPath is required in config file');
  }
}

// Check log file exists
function checkLogFile(pathToLogs) {
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

// Using an initialized mcodeClient, extract data for patient ids in the appropriate toDate-fromDate range
async function extractDataForPatients(patientIds, mcodeClient, fromDate, toDate) {
  /* eslint-disable no-restricted-syntax */
  /* eslint-disable no-await-in-loop */
  // Track if these runs were successful; if not, don't log a new RunInstance
  let successfulExtraction = true;
  const totalExtractionErrors = {};
  const extractedData = [];
  for (const [index, mrn] of patientIds.entries()) {
    totalExtractionErrors[index] = [];
    try {
      logger.info(`Extracting information for patient at row ${index + 1} in .csv file`);
      const { bundle, extractionErrors } = await mcodeClient.get({ mrn, fromDate, toDate });
      totalExtractionErrors[index].push(...extractionErrors);
      const resourceCount = getResourceCountInBundle(bundle);
      logger.info(`Resources extracted for patient ${index + 1} in .csv file`);
      Object.keys(resourceCount).forEach((resourceType) => logger.info(`${resourceType}: ${resourceCount[resourceType]} extracted`));
      extractedData.push(bundle);
    } catch (fatalErr) {
      successfulExtraction = false;
      totalExtractionErrors[index].push(fatalErr);
      logger.error(`Fatal error extracting data: ${fatalErr.message}`);
      logger.debug(fatalErr.stack);
    }
  }

  return { extractedData, successfulExtraction, totalExtractionErrors };
}

// Given a list of errorObjects where each object may have novel errors for the same patient-row,
// return a zipped object that combines the list of errors for each patient row into a single row
function zipErrors(...allErrorSources) {
  // NOTE: assumes each error object is a k-v pair: k is the MRN-id CSV row of the patient, v is an [errors] for that patient at some pipeline step
  const zippedErrors = {};

  allErrorSources.forEach((errorObject) => {
    const keys = Object.keys(errorObject);
    keys.forEach((key) => {
      if (zippedErrors[key] === undefined) {
        zippedErrors[key] = [];
      }
      zippedErrors[key] = zippedErrors[key].concat(errorObject[key]);
    });
  });
  return zippedErrors;
}

async function app(Client, fromDate, toDate, pathToConfig, pathToRunLogs, debug, allEntries) {
  try {
    if (debug) logger.level = 'debug';
    // Don't require a run-logs file if we are extracting all-entries. Only required when using --entries-filter.
    if (!allEntries) checkLogFile(pathToRunLogs);
    const config = getConfig(pathToConfig);
    checkInputAndConfig(config, fromDate, toDate);
    const icareClient = new Client(config);

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
        logger.info('Logging successful run information to records');
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
  app,
};
