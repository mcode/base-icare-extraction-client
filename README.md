# ICAREdata Extraction Client

The ICAREdata Extraction Client supports extracting the data elements required for ICAREdata, using CSV files.

## Prerequisites for Use

ICARE Extraction Client requires that [Node.js](https://nodejs.org/en/) is installed on the user's system. Node.js 10 or later is supported. Users will also need to have all dependencies installed. If this tool is packaged with all required dependencies in a `node_modules` folder, nothing new needs to be installed. If not, run:

```bash
npm install
```

## Prerequisites for Development

After making changes to any of the dependent libraries, including the [mCODE Extraction Framework](https://github.com/mcode/mcode-extraction-framework), you will need to run the following command ensure you have the updated dependencies:

```bash
npm install
```

If you need to update the version of a package (e.g. update `mcode-extraction-framework`), run the following:

```bash
npm upgrade <pkg-name>
```

## General Usage

The ICARE Extraction Client uses the [mCODE Extraction Framework](https://github.com/mcode/mcode-extraction-framework) to extract ICAREdata elements through extractors.

To use the ICARE Extraction Client, you will need to define a configuration file to specify what extractors to use and other basic information. An example configuration file can be found in [`config/config.example.json`](config/config.example.json). For more information, see [Configuration](#Configuration).

Once you have a configuration file, you can use the ICARE Extraction client by running the following:

```bash
node src/cli.js [options]
```

In order to extract data elements, run:

```bash
node src/cli.js --from-date <date> --path-to-config <path-to-config-file>
```

To see all the options that can be used with the ICARE client, run the following:

```bash
node src/cli.js --help
```

## Extraction Date Range

The ICARE Extraction Client extracts provided data that falls within a specified date range. Whenever the ICARE Extraction Client successfully runs, a log is kept of the given date range of the extraction. Users will need to specify the location of the file to save this information. The default location is in a `logs` directory in a file called `run-logs.json`. Initially, this file's contents should be an empty array, `[]`. Users will need to create this file before running the ICARE Extraction Client for the first time.

Users can specify a different location for the file by using the `--path-to-run-logs <path>` CLI option. For example:

```bash
node src/cli.js --path-to-run-logs path/to/file.json
```

If a `from-date` is provided as an option when running the ICARE Extraction Client, it will be used to filter out any data elements that are recorded before that date. If a `to-date` is provided as an option, it will be used to filter out any data elements that are recorded after that date. If no `to-date` is provided, the default is today. If no `from-date` is provided, the ICARE Extraction Client will look to the run log file to find the most recent run and use the `to-date` of that run as the `from-date` for the current run, allowing users to only run the extraction on data elements that were not included in previous runs. If there are no previous run times logged, a `from-date` needs to be provided when running the extraction.

## Configuration

Each deployment of the ICARE Extraction Client needs a configuration file. This file will specify basic information that every run will use. The configuration file can live in the `config` directory or any directory you prefer. An illustrative example file can be found in [`config/icare-csv-config.example.json`](config/icare-csv-config.example.json).

To specify which patients the client should extract data for, the configuration file _must_ point to a CSV file containing MRNs for each patient. An example of this file can be found in [`data/csv/patient-mrns.csv`](data/csv/patient-mrns.csv).

To successfully post extracted resources to the ICAREdata infrastructure, you _must_ modify the `awsConfig` object to provide proper AWS credentials. This can be done after your keycloak account has been set up.

Each extractor uses various methods to gather data and format that data into [mCODE](http://hl7.org/fhir/us/mcode/index.html) profiled resources. Extractors may require additional configuration items that can be specified in the configuration file. In order to run the ICARE Extraction Client, you will need extractors for the following resources:

- [patient](http://www.hl7.org/fhir/patient.html)
- [condition](http://www.hl7.org/fhir/condition.html)
- clinical trial information, which includes [research study](https://www.hl7.org/fhir/researchstudy.html) and [research subject](https://www.hl7.org/fhir/researchsubject.html)
- [cancer disease status](http://hl7.org/fhir/us/mcode/StructureDefinition-mcode-cancer-disease-status.html)
- [care plan with review](http://standardhealthrecord.org/guides/icare/StructureDefinition-icare-care-plan-with-review.html)

## CSV Extraction

In order to extract data elements from CSV files, in addition to the specifications above, your configuration file _must_ use the appropriate CSV Extractors for ICAREdata resources. An example configuration that specifies each extractor and its required configuration can be found in [`config/icare-csv-config.example.json`](config/icare-csv-config.example.json).

For the CSV extractors to work, each extractor _must_ point to a CSV file in the specified format. Examples of the format required for each extractor can be found in the [`data/csv`](data/csv) directory. These files provide examples of the values that are expected in each column, but they are not based on any real patient data.

- Patient information CSV example: [`patient-information.csv`](data/csv/patient-information.csv)
- Condition information CSV example: [`condition-information.csv`](data/csv/condition-information.csv)
- Clinical trial information CSV example: [`clinical-trial-information.csv`](data/csv/clinical-trial-information.csv)
- Cancer disease status CSV example: [`cancer-disease-status-information.csv`](data/csv/cancer-disease-status-information.csv)
- Care plan with review CSV example: [`treatment-plan-change-information.csv`](data/csv/treatment-plan-change-information.csv)

More information on the data that should be provided in each CSV file can be found in the [mCODE Extraction Framework documentation](https://github.com/mcode/mcode-extraction-framework/blob/master/docs/CSV_Templates_20200806.xlsx). Note that not all fields are currently supported.

To use the CSV Extraction with the default configuration file, run the following:

```bash
node src/cli.js -p config/icare-csv-config.example.json -f 2020-01-01
```
