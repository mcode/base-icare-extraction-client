const _ = require('lodash');
const { extractDataForPatients,
  // getResourceCountInBundle
} = require('../src/icareExtraction');
const testBundle = require('./fixtures/message-bundle.json');

// Utility for flattening error values
function flattenErrorValues(errorValues) {
  return _.flatten(Object.values(errorValues));
}

describe('icareExtraction', () => {
  // TODO: Move over to MEF, rename clients to be generic
  describe('extractDataForPatients', () => {
    const mockIcareClient = jest.fn().mockImplementation(() => ({
      get: jest.fn(),
    }))();
    const testPatientIds = ['123', '456', '789'];
    const testFromDate = '2020-01-01';
    const testToDate = '2020-06-30';

    it('should return extracted data when client successful returns a message bundle', async () => {
      mockIcareClient.get.mockClear();
      mockIcareClient.get.mockReturnValue({ bundle: testBundle, extractionErrors: [] });
      const { extractedData, successfulExtraction, totalExtractionErrors } = await extractDataForPatients(testPatientIds, mockIcareClient, testFromDate, testToDate);
      expect(successfulExtraction).toEqual(true);
      const flattenedErrorValues = flattenErrorValues(totalExtractionErrors);
      expect(flattenedErrorValues).toEqual([]);
      expect(mockIcareClient.get).toHaveBeenCalledTimes(testPatientIds.length);
      expect(extractedData).toEqual(expect.arrayContaining([testBundle]));
    });

    it('should fail to execute if a fatal error is produced in the extracting data', async () => {
      const fatalError = new Error('Fatal error');

      mockIcareClient.get.mockClear();
      mockIcareClient.get.mockImplementation(() => { throw fatalError; });

      const {
        // extractedData,
        successfulExtraction,
        totalExtractionErrors } = await extractDataForPatients(testPatientIds, mockIcareClient, testFromDate, testToDate);
      expect(mockIcareClient.get).toHaveBeenCalledTimes(testPatientIds.length);
      expect(successfulExtraction).toEqual(false);
      const flatErrors = flattenErrorValues(totalExtractionErrors);
      expect(flatErrors).toHaveLength(testPatientIds.length);
    });

    it('should return errors when there are errors in the icareClient get', async () => {
      const testError = new Error('testing error during client get');
      mockIcareClient.get.mockClear();
      mockIcareClient.get.mockReturnValue({ bundle: testBundle, extractionErrors: [testError] });

      const { extractedData, successfulExtraction, totalExtractionErrors } = await extractDataForPatients(testPatientIds, mockIcareClient, testFromDate, testToDate);
      expect(mockIcareClient.get).toHaveBeenCalledTimes(testPatientIds.length);
    });
  });

  describe('getResourceCountInBundle', () => {
    // TODO: MAKE TESTS HERE
    // getResourceCountInBundle;
  });
});
