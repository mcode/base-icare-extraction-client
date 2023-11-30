const { CSVExtractors, dependencyInfo, BaseClient, sortExtractors } = require('mcode-extraction-framework');
const { generateNewMessageBundle } = require('./icareFhirMessaging');

class ICARECSVClient extends BaseClient {
  constructor({ extractors, commonExtractorArgs }) {
    super();
    this.registerExtractors(...CSVExtractors);
    // Store the extractors defined by the configuration file as local state
    this.extractorConfig = extractors;
    // Sort extractors based on order and dependencies
    this.extractorConfig = sortExtractors(this.extractorConfig, dependencyInfo);
    this.commonExtractorArgs = {
      implementation: 'icare',
      ...commonExtractorArgs,
    };
  }

  async get(args) {
    const { bundle, extractionErrors } = await super.get(args);
    return { bundle: generateNewMessageBundle(bundle), extractionErrors };
  }
}

module.exports = {
  ICARECSVClient,
};
