const {
  BaseClient,
  CSVCancerDiseaseStatusExtractor,
  CSVObservationExtractor,
  CSVConditionExtractor,
  CSVClinicalTrialInformationExtractor,
  CSVPatientExtractor,
  CSVProcedureExtractor,
  CSVTreatmentPlanChangeExtractor,
  CSVCancerRelatedMedicationExtractor,
} = require('mcode-extraction-framework');
const { generateNewMessageBundle } = require('./icareFhirMessaging');

class ICARECSVClient extends BaseClient {
  constructor({ extractors, commonExtractorArgs }) {
    super();
    this.registerExtractors(
      CSVCancerDiseaseStatusExtractor,
      CSVConditionExtractor,
      CSVClinicalTrialInformationExtractor,
      CSVPatientExtractor,
      CSVProcedureExtractor,
      CSVTreatmentPlanChangeExtractor,
      CSVObservationExtractor,
      CSVCancerRelatedMedicationExtractor,
    );
    // Store the extractors defined by the configuration file as local state
    this.extractorConfig = extractors;
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
