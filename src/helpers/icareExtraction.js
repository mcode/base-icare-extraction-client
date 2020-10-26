const _ = require('lodash');
const { v4 } = require('uuid');
const moment = require('moment');
const fhirpath = require('fhirpath');
const { logger } = require('mcode-extraction-framework');

function makeUUIDFullUrl(uuid) {
  // Utility for ensuring UUID's follow a valid URL specification as described by FHIR R4“
  return `urn:uuid:${uuid}`;
}

function getResourceCountInBundle(messageBundle) {
  return messageBundle.entry[1].resource.entry.reduce((accumulator, resource) => {
    const { resourceType } = resource.resource;
    accumulator[resourceType] = accumulator[resourceType] ? accumulator[resourceType] + 1 : 1;
    return accumulator;
  }, {});
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

async function extractDataForPatients(patientIds, mcodeClient, fromDate, toDate) {
  // Using an initialized mcodeClient, extract data for patient ids in the appropriate toDate-fromDate range
  const totalExtractionErrors = {};
  const extractedData = [];
  // Track if these runs were successful; if not, don't log a new RunInstance
  let successfulExtraction = true;
  /* eslint-disable no-restricted-syntax */
  /* eslint-disable no-await-in-loop */
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

module.exports = {
  getResourceCountInBundle,
  generateNewMessageBundle,
  extractDataForPatients,
};
