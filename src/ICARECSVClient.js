const {
  BaseClient,
  CSVCancerDiseaseStatusExtractor,
  CSVConditionExtractor,
  CSVClinicalTrialInformationExtractor,
  CSVPatientExtractor,
  CSVTreatmentPlanChangeExtractor,
} = require('mcode-extraction-framework');
const { generateNewMessageBundle } = require('./helpers/icareBundling');

class ICARECSVClient extends BaseClient {
  constructor({ extractors, commonExtractorArgs }) {
    super();
    this.registerExtractors(
      CSVCancerDiseaseStatusExtractor,
      CSVConditionExtractor,
      CSVClinicalTrialInformationExtractor,
      CSVPatientExtractor,
      CSVTreatmentPlanChangeExtractor,
    );
    this.initializeExtractors(extractors, commonExtractorArgs);
  }

  async get(args) {
    const { bundle, extractionErrors } = await super.get(args);
    return { bundle: generateNewMessageBundle(bundle), extractionErrors };
  }
}

module.exports = {
  ICARECSVClient,
};
