import { styleText } from 'node:util';
//import { errorMonitor } from 'node:events';
export const logDanger = styleText(['yellow', 'bgRed', 'bold'], 'Danger');
export const logWarning = styleText(['yellow', 'bgBlack', 'bold'], 'Warning');
export const logInfo = styleText(['white', 'bgBlue', 'bold'], 'Information');
