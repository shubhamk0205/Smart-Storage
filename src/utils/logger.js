import winston from 'winston';
import { appConfig } from '../config/app.config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
    }
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
  }),
  new winston.transports.File({
    filename: path.join(appConfig.logging.filePath, 'error.log'),
    level: 'error',
    format: logFormat,
  }),
  new winston.transports.File({
    filename: path.join(appConfig.logging.filePath, 'combined.log'),
    format: logFormat,
  }),
];

const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

export default logger;
