const _ = require('lodash');
const testBundle = require('./fixtures/message-bundle.json');
const { checkMessagingClient, postExtractedData } = require('../src/icareFhirMessaging');

const mockMessagingClient = jest.fn().mockImplementation(() => ({
  authorize: jest.fn(),
  canSendMessage: jest.fn(),
  processMessage: jest.fn(),
}))();

// Utility for flattening error values
function flattenErrorValues(errorValues) {
  return _.flatten(Object.values(errorValues));
}

describe('icareFhirMessaging', () => {
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
    it('should post data successfully when supplied appropriate message bundles', async () => {
      mockMessagingClient.canSendMessage.mockReturnValue(true);
      // postExtractedData expects an araray of bundles, one for each patient
      const arrayOfBundles = [testBundle.testBundle, testBundle];
      const { successfulMessagePost, messagingErrors } = await postExtractedData(mockMessagingClient, arrayOfBundles);
      expect(successfulMessagePost).toEqual(true);
      const flattenedErrorValues = flattenErrorValues(messagingErrors);
      expect(flattenedErrorValues).toEqual([]);
      expect(mockMessagingClient.processMessage).toHaveBeenCalledTimes(arrayOfBundles.length);
    });

    it('should fail to post data when messaging client cannot process message', async () => {
      mockMessagingClient.processMessage.mockImplementation(() => {
        throw new Error();
      });
      const { successfulMessagePost, messagingErrors } = await postExtractedData(mockMessagingClient, [testBundle]);
      expect(successfulMessagePost).toEqual(false);
      const flattenedErrorValues = flattenErrorValues(messagingErrors);
      expect(flattenedErrorValues).not.toHaveLength(0);
    });
  });
});
