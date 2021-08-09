const rewire = require('rewire');
const testConfig = require('./fixtures/test-config.json');

const appUtils = rewire('../src/app.js');
const checkInputAndConfig = appUtils.__get__('checkInputAndConfig');

describe('appUtils', () => {
  describe('checkInputAndConfig', () => {
    it('should throw error when fromDate is invalid.', () => {
      expect(() => checkInputAndConfig(testConfig, '2020-06-31')).toThrowError('-f/--from-date is not a valid date.');
    });
    it('should throw error when toDate is invalid date.', () => {
      expect(() => checkInputAndConfig(testConfig, '2020-06-30', '2020-06-31')).toThrowError('-t/--to-date is not a valid date.');
    });
    it('should throw error when patientIdCsvPath not provided in config', () => {
      const patientCsvPathMissingConfig = { ...testConfig };
      delete patientCsvPathMissingConfig.patientIdCsvPath;
      expect(() => checkInputAndConfig(patientCsvPathMissingConfig)).toThrowError('patientIdCsvPath is required in config file');
    });
    it('should throw an error if awsConfig is missing when not in a test flight', () => {
      const awsMissingConfig = { ...testConfig };
      delete awsMissingConfig.awsConfig;
      expect(() => checkInputAndConfig(awsMissingConfig, '2020-06-01', '2020-06-30', false)).toThrowError('awsConfig is required in config file');
    });
    it('should not throw an error if awsConfig is missing when in a test flight', () => {
      const awsMissingConfig = { ...testConfig };
      delete awsMissingConfig.awsConfig;
      expect(() => checkInputAndConfig(awsMissingConfig, '2020-06-01', '2020-06-30', true)).not.toThrowError();
    });
    it('should not throw error when all args are valid', () => {
      expect(() => checkInputAndConfig(testConfig, '2020-06-01', '2020-06-30', false)).not.toThrowError();
    });
  });
});
