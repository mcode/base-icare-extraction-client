const {
  BaseClient,
  CSVAdverseEventExtractor,
  CSVCancerDiseaseStatusExtractor,
  CSVCancerRelatedMedicationAdministrationExtractor,
  CSVCancerRelatedMedicationRequestExtractor,
  CSVClinicalTrialInformationExtractor,
  CSVConditionExtractor,
  CSVCTCAdverseEventExtractor,
  CSVObservationExtractor,
  CSVPatientExtractor,
  CSVProcedureExtractor,
  CSVStagingExtractor,
  CSVTreatmentPlanChangeExtractor,
  sortExtractors,
} = require('mcode-extraction-framework');
const { generateNewMessageBundle } = require('./icareFhirMessaging');

class ICARECSVClient extends BaseClient {
  constructor({ extractors, commonExtractorArgs }) {
    super();
    this.registerExtractors(
      CSVAdverseEventExtractor,
      CSVCancerDiseaseStatusExtractor,
      CSVCancerRelatedMedicationAdministrationExtractor,
      CSVCancerRelatedMedicationRequestExtractor,
      CSVClinicalTrialInformationExtractor,
      CSVConditionExtractor,
      CSVCTCAdverseEventExtractor,
      CSVObservationExtractor,
      CSVPatientExtractor,
      CSVProcedureExtractor,
      CSVStagingExtractor,
      CSVTreatmentPlanChangeExtractor,
    );
    // Store the extractors defined by the configuration file as local state
    this.extractorConfig = extractors;
    // Define information about the order and dependencies of extractors
    const dependencyInfo = [
      { type: 'CSVPatientExtractor', dependencies: [] },
      { type: 'CSVConditionExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVCancerDiseaseStatusExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVClinicalTrialInformationExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVTreatmentPlanChangeExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVStagingExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVCancerRelatedMedicationAdministrationExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVCancerRelatedMedicationRequestExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVProcedureExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVObservationExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVAdverseEventExtractor', dependencies: ['CSVPatientExtractor'] },
      { type: 'CSVCTCAdverseEventExtractor', dependencies: ['CSVPatientExtractor'] },
    ];
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
