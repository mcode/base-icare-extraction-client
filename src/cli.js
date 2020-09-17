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
  .option('-a, --all-entries', 'Flag to indicate not to filter data by date', true)
  .option('--no-all-entries', 'Flag to indicate to filter data by date')
  .option('-p --path-to-config <path>', 'Specify relative path to config to use:', defaultPathToConfig)
  .option('-l --path-to-run-logs <path>', 'Specify relative path to log file of previous runs:', defaultPathToRunLogs)
  .option('-d, --debug', 'output extra debugging information')
  .parse(process.argv);

const {
  fromDate, toDate, pathToConfig, pathToRunLogs, debug, allEntries,
} = program;

app(ICARECSVClient, fromDate, toDate, pathToConfig, pathToRunLogs, debug, null, allEntries);
