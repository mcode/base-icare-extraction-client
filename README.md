# ICAREdata Extraction Client

The ICAREdata Extraction Client supports extracting the ICAREdata data elements from CSV files.

## Prerequisites

- [Node.js >= 12](https://nodejs.org/en/)

## General Usage

Once you have exported CSV data and updated your configuration file, use the ICARE Extraction client by running the following:

```bash
node src/cli.js [options]
```

To see all the options that can be used with the ICARE client, run the following:

```bash
node src/cli.js --help
```

## First Time User Guide

ICARE Extraction Client requires that [Node.js](https://nodejs.org/en/) is installed on the user's system. Node.js >=12 is supported. The ICARE Extraction Client is distributed with all dependent packages installed.

To run the ICARE Extraction Client you must have:

1. A CSV file at `data/patient-mrns.csv` that contains a list of all MRN's to be extracted;
2. CSV files containing the patient data to transform into mCODE data;
3. A configuration file that points to your data and provides additional information.

### CSV File Formats: Steps 1 & 2

CSV data for each extractor is expected in the `data` directory. In particular, the following CSV files need to be created and exported.

- `data/patient-mrns.csv` which adheres to the [Patient MRN's CSV Schema](https://github.com/mcode/mcode-extraction-framework/blob/master/docs/patient-mrns.csv)
- `data/patient-information.csv` which adheres to the [Patient CSV Schema](https://github.com/mcode/mcode-extraction-framework/blob/master/docs/patient.csv)
- `data/condition-information.csv` which adheres to the [Condition CSV Schema](https://github.com/mcode/mcode-extraction-framework/blob/master/docs/condition.csv)
- `data/clinical-trial-information.csv` which adheres to the [Clinical trial CSV Schema](https://github.com/mcode/mcode-extraction-framework/blob/master/docs/clinical-trial-information.csv)
- `data/cancer-disease-status-information.csv` which adheres to the [Cancer disease status CSV Schema](https://github.com/mcode/mcode-extraction-framework/blob/master/docs/cancer-disease-status.csv)
- `data/treatment-plan-change-information.csv` which adheres to the [Care plan with review CSV Schema](https://github.com/mcode/mcode-extraction-framework/blob/master/docs/treatment-plan-change.csv)

Examples files for these extractor can be found in the [`test/sample-client-data`](test/sample-client-data) directory. Files there provide examples of the values that are expected in each column, but they are not based on any real patient data.

More information on the data that should be provided in each CSV file can be found in the [mCODE Extraction Framework documentation](https://github.com/mcode/mcode-extraction-framework/blob/master/docs/CSV_Templates_20200806.xlsx). Note that not all fields are currently supported.

### Configuration Files: Step 3

After exporting your CSV files to the `data` directory, kickstart the creation of a configuration file by renaming the provided `csv.config.example.json` to `csv.config.json`. Then, ensure the following configuration parameters are properly set:

1. `patientIdCsvPath` should provide a file path to a CSV file containing MRN's for relevant patients;
2. For each extractor, `filePath:` should provide a file path to a CSV file containing that corresponding extractor's data;
3. For the ClinicalInformationExtractor, `clinicalSiteID` should correspond to the researchId used by your clinical site in support of the ICAREdata trial;
4. The `awsConfig` object needs to be updated to include the following fields with information that is sent separately by the ICAREdata team:
   - A `baseURL` field that indicates the base URL of the server to post messages to.
   - A `clientId` field containing the client ID that is registered for the ICAREdata OAuth2 framework.
   - An `aud` field containing the audience parameter that is registered for the client in the ICAREdata OAuth2 framework.
   - And private-key information corresponding to the registered client in the ICAREdata OAuth2 framework, which can be provided in two formats:
     - Two fields - `pkcs12` and `pkcs12Pass` - where the former is a filepath to your locally saved P12 file and the latter is the password for opening that file, or;
     - A `jwk` field, containing a JWK-JSON object configured to contain the relevant private-key information.


For instructions on setting up an email notification trigger whenever an error is encountered in extraction, see the [Email Notification](#Email-Notification) section below.`

## Configuration Deep Dive

Each deployment of the ICARE Extraction Client needs a configuration file. This file will specify basic information that every run will use. The configuration file can live in the `config` directory or any directory you prefer. An illustrative example file can be found in [`config/csv.config.example.json`](config/csv.config.example.json).

To specify which patients the client should extract data for, the configuration file _must_ point to a CSV file containing MRNs for each patient. The format for this file can be found [here](https://github.com/mcode/mcode-extraction-framework/blob/master/docs). An example of this file can be found in [`test/sample-client-data/patient-mrns.csv`](test/sample-client-data/patient-mrns.csv).

To successfully post extracted resources to the ICAREdata infrastructure, you _must_ modify the `awsConfig` object to provide proper AWS credentials. This can be done after your keycloak account has been set up.

Each extractor uses various methods to gather data and format that data into [mCODE](http://hl7.org/fhir/us/mcode/index.html) profiled resources. The `observation` extractor formats data into a general [FHIR R4](http://hl7.org/fhir/R4) profile. Extractors may require additional configuration items that can be specified in the configuration file. In order to run the ICARE Extraction Client, you will need extractors for the following resources:

- [patient](http://www.hl7.org/fhir/patient.html)
- [condition](http://www.hl7.org/fhir/condition.html)
- clinical trial information, which includes [research study](https://www.hl7.org/fhir/researchstudy.html) and [research subject](https://www.hl7.org/fhir/researchsubject.html)
- [cancer disease status](http://hl7.org/fhir/us/mcode/StructureDefinition-mcode-cancer-disease-status.html)
- [care plan with review](http://standardhealthrecord.org/guides/icare/StructureDefinition-icare-care-plan-with-review.html)

## Email Notification

The ICARE Extraction Client supports sending an email using the SMTP protocol when there are errors during data extraction.
The connection to the SMTP server is considered authenticated from the start. Currently, there is no support for providing authentication information separately through configuration.

In order to send an email, users must specify the hostname or IP address of an SMTP server to connect to and the email addresses to send the email to. Optionally, users can specify the port to connect to and the email address to send from. These fields must be specified in the `notificationInfo` object in the configuration file. Below is more information on each field that can be specified. Further information can be found in the [`nodemailer` documentation](https://nodemailer.com/) for the [SMTP transport](https://nodemailer.com/smtp/) and [message configuration](https://nodemailer.com/message/).

- `host`: `<string>` The hostname or IP address of an SMTP server to connect to
- `port`: `<number>` (Optional) The port to connect to (defaults to 587)
- `to`: `<string[]>` Comma separated list or an array of recipients email addresses that will appear on the _To:_ field
- `from`: `<string>` (Optional) The email address of the sender. All email addresses can be plain `'sender@server.com'` or formatted `'"Sender Name" sender@server.com'` (defaults to mcode-extraction-errors@mitre.org, which cannot receive reply emails)
- `tlsRejectUnauthorized`: `<boolean>` (Optional) A boolean value to set the [node.js TLSSocket option](https://nodejs.org/api/tls.html#tls_class_tls_tlssocket) for rejecting any unauthorized connections, `tls.rejectUnauthorized`.  (defaults to `true`)

An example of this object can be found in [`config/csv.config.example.json`](config/csv.config.example.json).

If the `notificationInfo` object is provided in configuration, an email will be sent using the specified options if any errors occur during data extraction. If any required field is missing in the object (`host` or `to`), an email cannot be sent. If you prefer to not have an email sent even if errors occur, you can choose to not include the `notificationInfo` object in your configuration file.

## Logging Successful Extractions

Whenever the ICARE Extraction Client successfully runs, a log is kept of the given date range of the extraction. Users will need to specify the location of the file to save this information. The default location is in a `logs` directory in a file called `run-logs.json`. Initially, this file's contents should be an empty array, `[]`. Users will need to create this file before running the ICARE Extraction Client with `from-date` and/or `to-date` for the first time.

Users can specify a different location for the file by using the `--run-log-filepath <path>` CLI option. For example:

```bash
node src/cli.js --run-log-filepath path/to/file.json
```

## Test Flight

In order to test the extraction of ICARE data without posting to an ICAREdata AWS environment, use the `--test-flight` CLI option. For example:

```bash
node src/cli.js --test-flight
```

When this flag is used, the ICARE Extraction Client will execute full extraction using any extractors specified in the configuration file. However, no data will be sent to the AWS environment specified in the configuration file and no data will be output to a file. This flag is intended to be used for debugging and ensuring extraction is successful before posting any data.

## Masking Patient Data

Patient data can be masked within the extracted `Patient` resource. When masked, the value of the field will be replaced with a [Data Absent Reason extension](https://www.hl7.org/fhir/extension-data-absent-reason.html) with the code `masked`.
Patient properties that can be masked are: `gender`, `mrn`, `name`, `address`, `birthDate`, `language`, `ethnicity`, `birthsex`, and `race`.
To mask a property, provide an array of the properties to mask in the `constructorArgs` of the Patient extractor. For example, the following configuration can be used to mask `address` and `birthDate`:

```bash
{
  "label": "patient",
  "type": "CSVPatientExtractor",
  "constructorArgs": {
    "filePath": "./data/patient-information.csv"
    "mask": ["address", "birthDate"]
  }
}
```

## Extraction Date Range

The ICARE Extraction Client will extract all data that is provided in the CSV files by default, regardless of any dates associated with each row of data. It is recommended that any required date filtering is performed outside of the scope of this client.

If for any reason a user is required to specify a date range to be extracted through this client, users _must_ add a `dateRecorded` column in every data CSV file. This column will indicate when each row of data was added to the CSV file. Note that this date _does not_ correspond to any date associated with the data element.

### CLI From-Date and To-Date (NOT recommended use)

If any filtering on data elements in CSV files is required, the `entries-filter` option must be used. The remaining instructions in this section assume this flag is provided.

If a `from-date` is provided as an option when running the ICARE Extraction Client, it will be used to filter out any data elements that are recorded before that date based on the `dateRecorded` column in the CSV files. If a `to-date` is provided as an option, it will be used to filter out any data elements that are recorded after that date based on the `dateRecorded` column in the CSV files. If no `to-date` is provided, the default is today. If no `from-date` is provided, the ICARE Extraction Client will look to a run log file (details [above](#Logging-Successful-Extractions)) to find the most recent run and use the `to-date` of that run as the `from-date` for the current run, allowing users to only run the extraction on data elements that were not included in previous runs. If there are no previous run times logged, a `from-date` needs to be provided when running the extraction when the `entries-filter` option is provided. If the `entries-filter` option is not provided, any `from-date` and `to-date` options will be ignored, none of the data elements will be filtered by date, and a successful run will not be logged since there is no specified date range. An example running the client with the `from-date` and `to-date` is as follows:

```bash
node src/cli.js --entries-filter --from-date <YYYY-MM-DD> --to-date <YYYY-MM-DD> --config-filepath <path>
```

## Developer Guide

After making changes to any of the dependent libraries, including the [mCODE Extraction Framework](https://github.com/mcode/mcode-extraction-framework), you will need to run the following command ensure you have the updated dependencies:

```bash
npm install
```

If you need to update the version of a package (e.g. update `mcode-extraction-framework`), run the following:

```bash
npm upgrade <pkg-name>
```


## License

(C) 2020 The MITRE Corporation. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
