const { logger } = require('mcode-extraction-framework');
const MessagingClient = require('fhir-messaging-client');

function getMessagingClient(config) {
  // Check if there is path to the AWS config within our config JSON
  if (!config || !config.awsConfig) {
    throw new Error('config file is missing `awsConfig` field, which is required to create a messagingClient instance');
  }
  return new MessagingClient(config.awsConfig);
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

async function postExtractedData(messagingClient, bundledData) {
  // Ensure that the messagingClient can receive messages
  await checkMessagingClient(messagingClient);

  let successfulMessagePost = true;
  // Error object where each bundle has an array of errors associated with it
  const messagingErrors = {};
  bundledData.forEach(async (bundle, i) => {
    messagingErrors[i] = [];
    try {
      await messagingClient.processMessage(bundle);
      logger.info(`SUCCESS - sent message for patient at row ${i + 1}`);
    } catch (e) {
      successfulMessagePost = false;
      messagingErrors[i].push(e);
      const violation = JSON.parse(e.response.data.errorMessage);
      const violationText = violation.entry[1].resource.issue.details.text;
      logger.error(`ERROR - could not send message for patient at row ${i + 1} - ${e.message} - ${violationText}`);
      logger.debug(e.stack);
    }
  });

  return { successfulMessagePost, messagingErrors };
}

module.exports = {
  checkMessagingClient,
  getMessagingClient,
  postExtractedData,
};
