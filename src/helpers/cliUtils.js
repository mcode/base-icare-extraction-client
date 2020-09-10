const parse = require('csv-parse/lib/sync');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const nodemailer = require('nodemailer');
const MessagingClient = require('fhir-messaging-client');
const { logger } = require('mcode-extraction-framework');
const { RunInstanceLogger } = require('../RunInstanceLogger');
const { getResourceCountInBundle } = require('./icareBundling');

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
  const errors = {};
  for (const [index, mrn] of patientIds.entries()) {
    errors[index] = [];
    try {
      logger.info(`Extracting information for patient at row ${index + 1} in .csv file`);
      const { bundle, extractionErrors } = await icareClient.get({ mrn, fromDate: effectiveFromDate, toDate });
      errors[index].push(...extractionErrors);
      const resourceCount = getResourceCountInBundle(bundle);
      logger.info(`Resources extracted for patient ${index + 1} in .csv file`);
      Object.keys(resourceCount).forEach((resourceType) => logger.info(`${resourceType}: ${resourceCount[resourceType]} extracted`));
      try {
        await messagingClient.processMessage(bundle);
        logger.info(`SUCCESS - sent message for patient at row ${index + 1}`);
      } catch (e) {
        successfulRun = false;
        errors[index].push(e);
        const violation = JSON.parse(e.response.data.errorMessage);
        const violationText = violation.entry[1].resource.issue.details.text;
        logger.error(`ERROR - could not send message for patient at row ${index + 1} - ${e.message} - ${violationText}`);
        logger.debug(e.stack);
      }
    } catch (err) {
      successfulRun = false;
      errors[index].push(err);
      logger.error(`Error extracting data: ${err.message}`);
      logger.debug(err.stack);
    }
  }

  if (successfulRun) {
    logger.info('Logging successful run information to records');
    runLogger.addRun(effectiveFromDate, toDate);
  }

  return errors;
}

async function app(Client, fromDate, toDate, pathToConfig, pathToRunLogs, debug, auth) {
  let errors = {};

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
    errors = await extractDataForPatients(auth, config, patientIds, icareClient, messagingClient, runLogger, effectiveFromDate, toDate);

    const totalErrors = Object.keys(errors).reduce((previousValue, currentValue) => previousValue += errors[currentValue].length, 0);
    const { notificationInfo } = config;
    if (notificationInfo && totalErrors > 0) {
      if (!notificationInfo.from || !notificationInfo.to || !notificationInfo.host || !notificationInfo.port) {
        throw new Error('Notification information incomplete. Unable to send email.')
      }

      // Aggregate errors
      let emailBody = 'Thank you for using the mCODE Extraction client, provided by the STEAM team. '
      emailBody += 'Unfortunately, the following errors occurred when running the extraction client:\n\n';
      Object.keys(errors).forEach((patientRow, i) => {
        emailBody += `Errors for patient at row ${parseInt(patientRow, 10) + 1} in .csv file:\n\n`;
        errors[patientRow].forEach((e) => emailBody += `${e.message.trim()}\n`);
        if (errors[patientRow].length === 0) {
          emailBody += 'No errors for this patient. Extraction was successful.\n'
        }
        emailBody += '\n===================================================\n\n';
      });
      emailBody += 'For more information about these errors, run the extraction client using the `--debug` flag';

      let transporter = nodemailer.createTransport({
        host: notificationInfo.host,
        port: notificationInfo.port
      });

      logger.debug('Sending email with error information');
      await transporter.sendMail({
        from: notificationInfo.from,
        to: notificationInfo.to,
        subject: "mCODE Extraction Client errors",
        text: emailBody
      });
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
