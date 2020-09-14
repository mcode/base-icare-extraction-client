const fs = require('fs');
const rewire = require('rewire');
const testConfig = require('./fixtures/test-config.json');
const testBundle = require('./fixtures/message-bundle.json');

const cliUtils = rewire('../../src/helpers/cliUtils.js');
/* eslint-disable no-underscore-dangle */
const checkMessagingClient = cliUtils.__get__('checkMessagingClient');
const checkConfig = cliUtils.__get__('checkConfig');
const checkLogFile = cliUtils.__get__('checkLogFile');
const getConfig = cliUtils.__get__('getConfig');
const getEffectiveFromDate = cliUtils.__get__('getEffectiveFromDate');
const extractDataForPatients = cliUtils.__get__('extractDataForPatients');
const sendEmailNotification = cliUtils.__get__('sendEmailNotification');
// Not entirely sure why nodemailer can't be imported directly and must be imported this way
const nodemailer = cliUtils.__get__('nodemailer');
/* eslint-enable no-underscore-dangle */
const pathToConfig = 'test/helpers/fixtures/test-config.json';
const fsSpy = jest.spyOn(fs, 'readFileSync');
const createTransportSpy = jest.spyOn(nodemailer, 'createTransport');
const mockRunLogger = jest.fn().mockImplementation(() => ({
  getMostRecentToDate: jest.fn(),
  addRun: jest.fn(),
}))();

const mockMessagingClient = jest.fn().mockImplementation(() => ({
  authorize: jest.fn(),
  canSendMessage: jest.fn(),
  processMessage: jest.fn(),
}))();

describe('cliUtils', () => {
  describe('getConfig', () => {
    it('should throw error when pathToConfig does not point to valid JSON file.', () => {
      expect(() => getConfig()).toThrowError();
    });

    it('should return test config', () => {
      const config = getConfig(pathToConfig);
      expect(config).toEqual(testConfig);
    });
  });

  describe('checkConfig', () => {
    const configWithoutAwsConfig = { patientIdCsvPath: 'example-path' };
    const configWithoutPatientIdCsvPath = { awsConfig: 'example-aws-config' };

    it('should throw error when fromDate is invalid.', () => {
      expect(() => checkConfig(testConfig, '2020-06-31')).toThrowError('-f/--from-date is not a valid date.');
    });
    it('should throw error when toDate is invalid date.', () => {
      expect(() => checkConfig(testConfig, '2020-06-30', '2020-06-31')).toThrowError('-t/--to-date is not a valid date.');
    });
    it('should throw error when awsConfig not provided in config', () => {
      expect(() => checkConfig(configWithoutAwsConfig)).toThrowError('patientIdCsvPath, awsConfig are required in config file');
    });
    it('should throw error when patientIdCsvPath not provided in config', () => {
      expect(() => checkConfig(configWithoutPatientIdCsvPath)).toThrowError('patientIdCsvPath, awsConfig are required in config file');
    });
    it('should not throw error when all args are valid', () => {
      expect(() => checkConfig(testConfig, '2020-06-01', '2020-06-30')).not.toThrowError();
    });
  });

  describe('checkLogFile', () => {
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

  describe('extractDataForPatients', () => {
    const testPatientIds = ['123', '456', '789'];
    const testFromDate = '2020-01-01';
    const testToDate = '2020-06-30';
    const mockIcareClient = jest.fn().mockImplementation(() => ({
      initAuth: jest.fn(),
      get: jest.fn(),
    }))();

    it('should call icareClient.initAuth with testConfig.auth when auth is true', async () => {
      await expect(extractDataForPatients(true, testConfig, testPatientIds, mockIcareClient)).rejects.toThrowError();
      expect(mockIcareClient.initAuth).toHaveBeenCalledWith('example-auth');
    });

    it('should not call icareClient.initAuth when auth is false', async () => {
      mockIcareClient.initAuth.mockClear();
      await expect(extractDataForPatients(false, testConfig, testPatientIds, mockIcareClient)).rejects.toThrowError();
      expect(mockIcareClient.initAuth).not.toHaveBeenCalled();
    });

    it('should log a successful run when icare client successful returns a message bundle', async () => {
      mockIcareClient.get.mockClear();
      mockRunLogger.addRun.mockClear();
      mockIcareClient.get.mockReturnValue({ bundle: testBundle, extractionErrors: [] });
      mockMessagingClient.canSendMessage.mockReturnValue(true);
      await expect(extractDataForPatients(true, testConfig, testPatientIds, mockIcareClient, mockMessagingClient, mockRunLogger, testFromDate, testToDate)).resolves.not.toThrowError();
      expect(mockIcareClient.get).toHaveBeenCalledTimes(testPatientIds.length);
      expect(mockRunLogger.addRun).toHaveBeenCalled();
    });

    it('should not log a successful run when messaging client cannot process message', async () => {
      mockIcareClient.get.mockClear();
      mockRunLogger.addRun.mockClear();
      mockIcareClient.get.mockReturnValue(testBundle);
      mockMessagingClient.processMessage.mockImplementation(() => {
        throw new Error();
      });
      await expect(extractDataForPatients(true, testConfig, testPatientIds, mockIcareClient, mockMessagingClient, mockRunLogger, testFromDate, testToDate)).resolves.not.toThrowError();
      expect(mockIcareClient.get).toHaveBeenCalledTimes(testPatientIds.length);
      expect(mockRunLogger.addRun).not.toHaveBeenCalled();
      mockMessagingClient.processMessage.mockReset();
    });
  });

  describe('checkMessagingClient', () => {
    it('should throw error when messaging client cannot send message', async () => {
      mockMessagingClient.canSendMessage.mockReturnValue(false);
      await expect(checkMessagingClient(mockMessagingClient)).rejects.toThrowError('The server does not provide the "system/$process-message" scope.');
    });

    it('should not throw error when messaging client can send message', async () => {
      mockMessagingClient.canSendMessage.mockReturnValue(true);
      await expect(checkMessagingClient(mockMessagingClient)).resolves.not.toThrowError();
    });

    it('should throw error when messaging client cannot authorize.', async () => {
      const errorMsg = 'cannot authorize';
      mockMessagingClient.authorize.mockImplementation(() => {
        throw new Error(errorMsg);
      });
      await expect(checkMessagingClient(mockMessagingClient)).rejects.toThrowError(`Could not authorize messaging client - ${errorMsg}`);
      mockMessagingClient.authorize.mockReset();
    });
  });

  describe('sendEmailNotification', () => {
    const sendMailMock = jest.fn();
    beforeEach(() => {
      sendMailMock.mockClear();
      createTransportSpy.mockClear();
    });

    it('should not send an email if there are no errors for any patient', async () => {
      const notificationInfo = {};
      const errors = {
        0: [],
        1: [],
        2: [],
      };

      await expect(sendEmailNotification(notificationInfo, errors)).resolves.not.toThrow();
      expect(createTransportSpy).not.toBeCalled();
      expect(sendMailMock).not.toBeCalled();
    });

    it('should throw an error when missing required notification options', async () => {
      const invalidNotificationInfo = {
        host: 'my.host.com',
      };
      const errors = {
        0: [],
        1: [{ message: 'something bad' }],
        2: [{ message: 'an error' }, { message: 'another error' }],
      };

      const errorMessage = 'Email notification information incomplete. Unable to send email with 3 errors.';
      await expect(sendEmailNotification(invalidNotificationInfo, errors)).rejects.toThrowError(errorMessage);
      expect(createTransportSpy).not.toBeCalled();
      expect(sendMailMock).not.toBeCalled();
    });

    it('should send an email according to config options with errors in the body', async () => {
      createTransportSpy.mockReturnValueOnce({ sendMail: sendMailMock });
      const notificationInfo = {
        host: 'my.host.com',
        port: 123,
        to: ['something@example.com', 'someone@example.com'],
        from: 'other@example.com',
      };
      const errors = {
        0: [],
        1: [{ message: 'something bad' }],
        2: [{ message: 'an error' }, { message: 'another error' }],
      };

      await expect(sendEmailNotification(notificationInfo, errors)).resolves.not.toThrow();
      expect(createTransportSpy).toBeCalledWith({ host: notificationInfo.host, port: notificationInfo.port });
      expect(sendMailMock).toBeCalled();
      const sendMailMockArgs = sendMailMock.mock.calls[0][0];
      expect(sendMailMockArgs.to).toEqual(notificationInfo.to);
      expect(sendMailMockArgs.from).toEqual(notificationInfo.from);
      expect(sendMailMockArgs.subject).toEqual('mCODE Extraction Client Errors');
      expect(sendMailMockArgs.text).toMatch(/something bad/i);
      expect(sendMailMockArgs.text).toMatch(/another error/i);
    });
  });
});
