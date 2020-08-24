const path = require('path');
const moment = require('moment');
const { ICARECSVClient } = require('../src/ICARECSVClient');
const exampleCondition = require('./fixtures/condition-bundle.json');

// Mock Values and Responses
const MOCK_FROM_DATE = '2019-01-01';
const MOCK_TO_DATE = '2019-12-31';
const MOCK_PATIENT_MRN = 'EXAMPLE-MRN';
const testConfig = {
  // These CSV paths don't point at actual data, but valid files are needed to avoid parser errors
  patientIdCsvPath: path.join(__dirname, './fixtures/csv/example.csv'),
  extractors: [
    {
      label: 'condition',
      type: 'CSVConditionExtractor',
      constructorArgs: {
        // These CSV paths don't point at actual data, but valid files are needed to avoid parser errors
        filePath: path.join(__dirname, './fixtures/csv/example.csv'),
      },
    },
  ],
};

const icareClient = new ICARECSVClient(testConfig);
// Spy on extractor get functions and mock return values
const condExtractorGetSpy = jest.spyOn(
  icareClient.extractors.find((ext) => ext.constructor.name === 'CSVConditionExtractor'),
  'get',
);
condExtractorGetSpy
  .mockReturnValue(exampleCondition);

describe('ICAREClient', () => {
  test('get returns a valid message bundle', async () => {
    const data = await icareClient.get({
      mrn: MOCK_PATIENT_MRN,
      fromDate: MOCK_FROM_DATE,
      toDate: MOCK_TO_DATE,
    });
    expect(data.resourceType).toEqual('Bundle');
    expect(data.type).toEqual('message');
    expect(data.timestamp).toEqual(moment().format('YYYY-MM-DDThh:mm:ssZ'));
    expect(data.entry).toBeDefined();
    expect(data.entry[0].resource.resourceType).toEqual('MessageHeader');
    expect(data.entry[1].resource.resourceType).toEqual('Bundle');
    expect(data.entry[1].resource.type).toEqual('collection');
    // Bundle-length should be 2 - 1 header and 1 collection resource
    expect(data.entry.length).toEqual(2);
    // messageHeader id should match messageHeader fullURLId
    expect(data.entry[0].resource.id).toEqual(data.entry[0].fullUrl.split(':')[2]);
    // messageBody id should match messageBody fullURLId
    expect(data.entry[1].resource.id).toEqual(data.entry[1].fullUrl.split(':')[2]);
    // messageBody id should match messageHeader focus
    expect(data.entry[1].resource.id).toEqual(data.entry[0].resource.focus[0].reference.split(':')[2]);
  });

  test('get returns a bundle containing all our example entries', async () => {
    const data = await icareClient.get({
      mrn: MOCK_PATIENT_MRN,
      fromDate: MOCK_FROM_DATE,
      toDate: MOCK_TO_DATE,
    });
    // Collection bundle has all expected entries, and no more than that
    const resourceTotal = exampleCondition.entry.length;

    expect(data.entry[1].resource.entry.length).toEqual(resourceTotal);
    expect(data.entry[1].resource.entry).toEqual(expect.arrayContaining([exampleCondition.entry[0]]));
  });
});
