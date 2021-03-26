const _ = require('lodash');
const { v4 } = require('uuid');
const moment = require('moment');
const fhirpath = require('fhirpath');
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

// This method is used to ensure AWS and FHIR messaging client are configured properly.
// It is intended to be used with the --test-aws-auth flag. These functions are called separately during extraction.
async function checkAwsAuthentication(config) {
  // Ensure that we have the necessary aws info in the config file and that a MessagingClient can be made
  const messagingClient = getMessagingClient(config);

  // Ensure that the messagingClient can receive messages
  await checkMessagingClient(messagingClient);
  logger.info('AWS authenticated properly');
}

function makeUUIDFullUrl(uuid) {
  // Utility for ensuring UUID's follow a valid URL specification as described by FHIR R4“
  return `urn:uuid:${uuid}`;
}

function generateNewMessageBundle(bundle) {
  // Generate a fhir message bundle structured according to the ICARE-submission procedure
  // link: https://github.com/ICAREdata/icare-data-submission-procedures
  const siteId = fhirpath.evaluate(
    bundle,
    'Bundle.entry.where(resource.resourceType=\'ResearchStudy\').resource.site',
  )[0];
  const siteIdValue = _.get(siteId, 'identifier.value', '');
  const entries = bundle.entry;
  logger.info(`Generating a new message bundle with ${entries.length} entries`);
  const dateFormat = 'YYYY-MM-DDThh:mm:ssZ';
  const messageHeaderId = v4();
  const messageBodyId = v4();
  return {
    resourceType: 'Bundle',
    id: v4(),
    type: 'message',
    timestamp: moment().format(dateFormat),
    entry: [
      {
        fullUrl: makeUUIDFullUrl(messageHeaderId),
        resource: {
          resourceType: 'MessageHeader',
          id: messageHeaderId,
          eventCoding: {
            system: 'http://example.org/fhir/message-events',
            code: 'icaredata-submission',
          },
          ...(siteId && { sender: siteId }),
          source: {
            endpoint: `http://icaredata.org/${siteIdValue}`,
          },
          focus: [
            {
              reference: makeUUIDFullUrl(messageBodyId),
            },
          ],
        },
      },
      {
        fullUrl: makeUUIDFullUrl(messageBodyId),
        resource: {
          resourceType: 'Bundle',
          id: messageBodyId,
          type: 'collection',
          entry: entries,
        },
      },
    ],
  };
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
      try {
        // Try to rely on the ICAREdata-submission defined error format to parse an informative message
        successfulMessagePost = false;
        messagingErrors[i].push(e);
        const violation = JSON.parse(e.response.data.errorMessage);
        const violationText = violation.entry[1].resource.issue.details.text;
        logger.error(`ERROR - could not send message for patient at row ${i + 1} - ${e.message} - ${violationText}`);
        logger.debug(e.stack);
      } catch (e2) {
        // We're provided an error that was produced before or after the process message function;
        // Handle this as a special case
        logger.error(`ERROR - could not parse processMessage response as expected, failed and produced "${e2.message}"
        processMessage error has status ${e.status} and message "${e.message}"
        `);
        logger.debug(e2.stack);
        logger.debug(e.stack);
      }
    }
  });

  return { successfulMessagePost, messagingErrors };
}

module.exports = {
  checkAwsAuthentication,
  checkMessagingClient,
  getMessagingClient,
  postExtractedData,
  generateNewMessageBundle,
};
