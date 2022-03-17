import pino, {Logger} from 'pino';
import {EventEmitter} from 'events';

interface CloudWatchLoggerOptions {
  appName: string;
}

export class CloudWatchLogger extends EventEmitter {
  private _logger: Logger;
  private appName: string;

  // Actual type in pino is an alias to any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transport: any;
  constructor(options: CloudWatchLoggerOptions) {
    super();
    this.appName = options.appName;
    this.transport = pino.transport({
      target: './transport.js',
      worker: {
        autoEnd: true,
      },
    });
    this._logger = pino(this.transport);

    // Pass it forwards
    this.transport.on('ready', () => this.emit('ready'));
    this.transport.on('error', (...args: unknown[]) =>
      this.emit('error', args)
    );
  }

  public trace(msg: string, options?: unknown) {
    this._logger.trace(
      Object.assign({}, options, {appName: this.appName}),
      msg
    );
  }

  public debug(msg: string, options?: unknown) {
    this._logger.debug(
      Object.assign({}, options, {appName: this.appName}),
      msg
    );
  }

  public info(msg: string, options?: unknown) {
    this._logger.info(Object.assign({}, options, {appName: this.appName}), msg);
  }

  public warn(msg: string, options?: unknown) {
    this._logger.warn(Object.assign({}, options, {appName: this.appName}), msg);
  }

  public error(msg: string, options?: unknown) {
    this._logger.error(
      Object.assign({}, options, {appName: this.appName}),
      msg
    );
  }
}
