const fs = require('fs');
const rewire = require('rewire');
const testConfig = require('./fixtures/test-config.json');

const appUtils = rewire('../src/app.js');
const checkInputAndConfig = appUtils.__get__('checkInputAndConfig');
const checkLogFile = appUtils.__get__('checkLogFile');
const getConfig = appUtils.__get__('getConfig');
const getEffectiveFromDate = appUtils.__get__('getEffectiveFromDate');

describe('appUtils', () => {
  describe('getConfig', () => {
    const pathToConfig = 'test/fixtures/test-config.json';

    it('should throw error when pathToConfig does not point to valid JSON file.', () => {
      expect(() => getConfig()).toThrowError();
    });

    it('should return test config', () => {
      const config = getConfig(pathToConfig);
      expect(config).toEqual(testConfig);
    });
  });

  describe('checkInputAndConfig', () => {
    it('should throw error when fromDate is invalid.', () => {
      expect(() => checkInputAndConfig(testConfig, '2020-06-31')).toThrowError('-f/--from-date is not a valid date.');
    });
    it('should throw error when toDate is invalid date.', () => {
      expect(() => checkInputAndConfig(testConfig, '2020-06-30', '2020-06-31')).toThrowError('-t/--to-date is not a valid date.');
    });
    it('should throw error when patientIdCsvPath not provided in config', () => {
      expect(() => checkInputAndConfig({})).toThrowError('patientIdCsvPath is required in config file');
    });
    it('should not throw error when all args are valid', () => {
      expect(() => checkInputAndConfig(testConfig, '2020-06-01', '2020-06-30')).not.toThrowError();
    });
  });

  describe('checkLogFile', () => {
    const fsSpy = jest.spyOn(fs, 'readFileSync');
    it('should throw error when not provided a path', () => {
      expect(() => checkLogFile()).toThrowError();
    });

    it('should throw error when path does not point to valid JSON', () => {
      expect(() => checkLogFile('./bad-path')).toThrowError();
    });

    it('should throw error when log file is not an array', () => {
      fsSpy.mockReturnValueOnce(Buffer.from('{}'));
      expect(() => checkLogFile('path')).toThrowError('Log file needs to be an array.');
      expect(fsSpy).toHaveBeenCalled();
    });

    it('should not throw error when log file is an array', () => {
      fsSpy.mockReturnValueOnce(Buffer.from('[]'));
      expect(() => checkLogFile('path')).not.toThrowError();
      expect(fsSpy).toHaveBeenCalled();
    });
  });

  describe('getEffectiveFromDate', () => {
    const testDate = '2020-06-16';
    const mockRunLogger = {
      getMostRecentToDate: jest.fn(),
      addRun: jest.fn(),
    };

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return fromDate when valid', () => {
      expect(getEffectiveFromDate(testDate)).toEqual(testDate);
    });

    it('should return most recent date from runLogger', () => {
      mockRunLogger.getMostRecentToDate.mockReturnValue(testDate);
      expect(getEffectiveFromDate(null, mockRunLogger)).toEqual(testDate);
    });

    it('should throw error when no recent date from runlogger', () => {
      expect(() => getEffectiveFromDate(null, mockRunLogger)).toThrowError();
      expect(mockRunLogger.getMostRecentToDate).toHaveBeenCalled();
    });
  });
});
