const _ = require('lodash');
const { v4 } = require('uuid');
const moment = require('moment');
const fhirpath = require('fhirpath');
const { logger } = require('mcode-extraction-framework');

function makeUUIDFullUrl(uuid) {
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

module.exports = {
  getResourceCountInBundle,
  generateNewMessageBundle,
};
