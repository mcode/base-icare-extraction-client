const fs = require('fs');
const rewire = require('rewire');
const testConfig = require('./fixtures/test-config.json');
const testBundle = require('./fixtures/message-bundle.json');
const { icareApp } = require('../src/cliUtils');

const cliUtils = rewire('../src/cliUtils.js');
const checkInputAndConfig = cliUtils.__get__('checkInputAndConfig');
const checkLogFile = cliUtils.__get__('checkLogFile');
const getConfig = cliUtils.__get__('getConfig');
const getEffectiveFromDate = cliUtils.__get__('getEffectiveFromDate');
const extractDataForPatients = cliUtils.__get__('extractDataForPatients');

describe('cliUtils', () => {
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
    const mockRunLogger = jest.fn().mockImplementation(() => ({
      getMostRecentToDate: jest.fn(),
      addRun: jest.fn(),
    }))();

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

  describe('icareApp', () => {
    // Mocks
    const mockRunLogger = jest.fn().mockImplementation(() => ({
      getMostRecentToDate: jest.fn(),
      addRun: jest.fn(),
    }))();
    const mockIcareClient = jest.fn().mockImplementation(() => ({
      get: jest.fn(),
    }))();
    const mockMessagingClient = jest.fn().mockImplementation(() => ({
      authorize: jest.fn(),
      canSendMessage: jest.fn(),
      processMessage: jest.fn(),
    }))();
    const testPatientIds = ['123', '456', '789'];
    const testFromDate = '2020-01-01';
    const testToDate = '2020-06-30';

    // it('should log a successful run when icare client successful returns a message bundle', async () => {
    //   mockIcareClient.get.mockClear();
    //   mockRunLogger.addRun.mockClear();
    //   mockIcareClient.get.mockReturnValue({ bundle: testBundle, extractionErrors: [] });
    //   mockMessagingClient.canSendMessage.mockReturnValue(true);
    //   await expect(icareApp(mockIcareClient, testPatientIds, mockMessagingClient, mockRunLogger, testFromDate, testToDate)).resolves.not.toThrowError();
    //   await expect(icareApp(true, testConfig, testPatientIds, mockIcareClient, mockMessagingClient, mockRunLogger, testFromDate, testToDate)).resolves.not.toThrowError();
    //   expect(mockIcareClient.get).toHaveBeenCalledTimes(testPatientIds.length);
    //   expect(mockRunLogger.addRun).toHaveBeenCalled();
    // });

    // it('should not log a successful run when messaging client cannot process message', async () => {
    //   mockIcareClient.get.mockClear();
    //   mockRunLogger.addRun.mockClear();
    //   mockIcareClient.get.mockReturnValue(testBundle);
    //   mockMessagingClient.processMessage.mockImplementation(() => {
    //     throw new Error();
    //   });
    //   await expect(icareApp(true, testConfig, testPatientIds, mockIcareClient, mockMessagingClient, mockRunLogger, testFromDate, testToDate)).resolves.not.toThrowError();
    //   expect(mockIcareClient.get).toHaveBeenCalledTimes(testPatientIds.length);
    //   expect(mockRunLogger.addRun).not.toHaveBeenCalled();
    //   mockMessagingClient.processMessage.mockReset();
    // });
  });
});
