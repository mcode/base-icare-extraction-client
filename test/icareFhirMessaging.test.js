const _ = require('lodash');
const MessagingClient = require('fhir-messaging-client');
const testConfig = require('./fixtures/test-config.json');
const testBundle = require('./fixtures/message-bundle.json');
const { checkMessagingClient, postExtractedData, getMessagingClient } = require('../src/icareFhirMessaging');

const mockMessagingClient = {
  authorize: jest.fn(),
  canSendMessage: jest.fn(),
  processMessage: jest.fn(),
};

// Utility for flattening error values
function flattenErrorValues(errorValues) {
  return _.flatten(Object.values(errorValues));
}

describe('icareFhirMessaging', () => {
  describe('getMessagingClient', () => {
    it('should throw error when awsConfig not provided in config', () => {
      expect(() => getMessagingClient({})).toThrowError('config file is missing `awsConfig` field, which is required to create a messagingClient instance');
    });
    it('should return a messaging Client when the config is valid', () => {
      const mClient = getMessagingClient(testConfig);
      expect(() => getMessagingClient(testConfig)).not.toThrowError();
      expect(mClient).toBeInstanceOf(MessagingClient);
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

  describe('postExtractedData', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it('should post data successfully when supplied appropriate message bundles', async () => {
      mockMessagingClient.canSendMessage.mockReturnValue(true);
      // postExtractedData expects an array of bundles, one for each patient
      const arrayOfBundles = [testBundle.testBundle, testBundle];
      const { successfulMessagePost, messagingErrors } = await postExtractedData(mockMessagingClient, arrayOfBundles);
      expect(successfulMessagePost).toEqual(true);
      const flattenedErrorValues = flattenErrorValues(messagingErrors);
      expect(flattenedErrorValues).toEqual([]);
      expect(mockMessagingClient.processMessage).toHaveBeenCalledTimes(arrayOfBundles.length);
    });

    it('should fail to post data when messaging client cannot process message', async () => {
      mockMessagingClient.canSendMessage.mockReturnValue(true);
      mockMessagingClient.processMessage.mockImplementation(() => {
        throw new Error();
      });
      const { successfulMessagePost, messagingErrors } = await postExtractedData(mockMessagingClient, [testBundle]);
      expect(successfulMessagePost).toEqual(false);
      const flattenedErrorValues = flattenErrorValues(messagingErrors);
      expect(flattenedErrorValues).not.toHaveLength(0);
    });

    it('should not attempt to post data when bundle does not contain extracted data', async () => {
      mockMessagingClient.canSendMessage.mockReturnValue(true);

      const bundleClone = _.cloneDeep(testBundle);
      bundleClone.entry[1].resource.entry = [];

      await postExtractedData(mockMessagingClient, [bundleClone]);
      expect(mockMessagingClient.processMessage).toHaveBeenCalledTimes(0);
    });
  });
});
