const path = require('path');
const program = require('commander');
const { ICARECSVClient } = require('./ICARECSVClient');
const { app } = require('./helpers/cliUtils');

const defaultPathToConfig = path.join('config', 'csv.config.json');
const defaultPathToRunLogs = path.join('logs', 'run-logs.json');

program
  .usage('[options]')
  .option('-f --from-date <date>', 'The earliest date and time to search')
  .option('-t --to-date <date>', 'The latest date and time to search')
  .option('-e, --entries-filter', 'Flag to indicate to filter data by date')
  .option('-c --config-filepath <path>', 'Specify relative path to config to use:', defaultPathToConfig)
  .option('-r --run-log-filepath <path>', 'Specify relative path to log file of previous runs:', defaultPathToRunLogs)
  .option('-d, --debug', 'output extra debugging information')
  .parse(process.argv);

const {
  fromDate, toDate, configFilepath, runLogFilepath, debug, entriesFilter,
} = program;

app(ICARECSVClient, fromDate, toDate, configFilepath, runLogFilepath, debug, !entriesFilter);
