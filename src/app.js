const moment = require('moment');
const {
  logger, sendEmailNotification, zipErrors, extractDataForPatients, RunInstanceLogger, parsePatientIds,
} = require('mcode-extraction-framework');
const { checkAwsAuthentication, getMessagingClient, postExtractedData } = require('./icareFhirMessaging');

function checkInputAndConfig(config, fromDate, toDate, testExtraction) {
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
  if (!patientIdCsvPath) {
    throw new Error('patientIdCsvPath is required in config file');
  }

  // AWS config is not required during test flight runs
  if (!testExtraction && !awsConfig) {
    throw new Error('awsConfig is required in config file');
  }
}

// TODO: There is a lot of overlap with this application and the mcode application,
// esp. when it comes to the configuration file helpers, log-file helpers and effective-date parsers;
// can improve later
async function icareApp(Client, fromDate, toDate, config, pathToRunLogs, debug, allEntries, testExtraction, testAwsAuth) {
  if (debug) logger.level = 'debug';
  if (testExtraction) logger.info('test-extraction will perform extraction but will not post any data');
  if (testAwsAuth) logger.info('test-aws-auth will authenticate to AWS but will not extract or post any data');
  checkInputAndConfig(config, fromDate, toDate, testExtraction);

  if (testAwsAuth) {
    // Check AWS configuration info and that messaging client is created and can send messages
    await checkAwsAuthentication(config);
    if (!testExtraction) return; // Since we don't want to extract any data, return
  }

  // Create and initialize client
  const icareClient = new Client(config);
  await icareClient.init();

  // Parse CSV for list of patient mrns
  const patientIds = parsePatientIds(config.patientIdCsvPath);

  // Get messaging client for messaging ICAREPlatform
  let messagingClient = null;
  if (!testExtraction) messagingClient = getMessagingClient(config);

  // Get RunInstanceLogger for recording new runs and inferring dates from previous runs
  const runLogger = allEntries ? null : new RunInstanceLogger(pathToRunLogs);
  const effectiveFromDate = allEntries ? null : runLogger.getEffectiveFromDate(fromDate, runLogger);
  const effectiveToDate = allEntries ? null : toDate;

  // Extract the data
  logger.info(`Extracting data for ${patientIds.length} patients`);
  const { extractedData, successfulExtraction, totalExtractionErrors } = await extractDataForPatients(patientIds, icareClient, effectiveFromDate, effectiveToDate);

  // Post the data using the messagingClient
  let successfulMessagePost = true;
  let messagingErrors = {};
  if (!testExtraction) {
    logger.info(`Posting data for ${patientIds.length} patients`);
    ({ successfulMessagePost, messagingErrors } = await postExtractedData(messagingClient, extractedData));
  }

  // Don't send emails if we're in a test-extraction run
  // If we have notification information, send an emailNotification
  const { notificationInfo } = config;
  if (!testExtraction && notificationInfo) {
    const notificationErrors = zipErrors(totalExtractionErrors, messagingErrors);
    await sendEmailNotification(notificationInfo, notificationErrors, debug);
  }

  // Only log successful runs if we're in a real run, not a test-extraction run
  // A run is successful and should be logged when both extraction finishes without fatal errors
  // and messages are posted without fatal errors
  if (!testExtraction && !allEntries && effectiveFromDate) {
    const successCondition = successfulExtraction && successfulMessagePost;
    if (successCondition) {
      runLogger.addRun(effectiveFromDate, effectiveToDate);
    }
  }
}

module.exports = {
  icareApp,
};
