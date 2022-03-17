import {once} from 'events';
import {EventEmitter} from 'events';
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  InputLogEvent,
  InvalidSequenceTokenException,
} from '@aws-sdk/client-cloudwatch-logs';

import {CONFIG} from './config';

function measureBytes(arr: string[]): number {
  return Buffer.byteLength(Buffer.from(strArr(arr)));
}

// This exists b/c I don't want any characters escaped by stringify
function strArr(arr: string[]) {
  return '[' + arr.toString() + ']';
}

export class Connection extends EventEmitter {
  CloudWatchClient: CloudWatchLogsClient;
  nextSequenceToken: string | null;

  constructor(private chuckBytes = 80000) {
    super();
    this.nextSequenceToken = null;

    const {accessKeyId, secretAccessKey} = CONFIG.credentials;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Missing AWS credentials');
    }

    this.CloudWatchClient = new CloudWatchLogsClient({
      region: CONFIG.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.initCloudWatch();

    // This is here to allow for async setup patterns if we end up needing one
    // And to follow patterns presented by pino
    // nextTick allows for listener registration in a synchronous process
    process.nextTick(() => this.emit('ready'));
  }

  private queue: string[] = [];

  private reQueue = true;

  private running = false;

  private timerRunning = false;

  private async workflow() {
    if (this.running) {
      return;
    }
    this.running = true;

    const currentBatch: string[] = [];
    do {
      const next = this.queue.shift();
      if (next) {
        currentBatch.push(next);
      }
    } while (
      measureBytes(currentBatch) < this.chuckBytes &&
      this.queue.length > 0
    );

    if (currentBatch.length) {
      try {
        const logEvents: InputLogEvent[] = currentBatch.map(event => {
          return {
            timestamp: Date.now(),
            message: event,
          };
        });

        this.writeToCloudWatch(logEvents);
      } catch (e) {
        this.queue.push(...currentBatch);
        this.emit('error', e);
        console.log(e);
      }
    }

    this.running = false;
    this.drain();
  }

  private timer?: NodeJS.Timer;
  private _trySend = () => {
    this.timer && clearTimeout(this.timer);
    this.timerRunning = false;
    if (measureBytes(this.queue) < this.chuckBytes) {
      this.workflow();
    } else {
      this.timerRunning = true;
      this.timer = setTimeout(() => {
        this.workflow();
        this.emit('timerFired');
      }, 100);
    }
  };

  private drain() {
    if (this.reQueue && this.queue.length) this.workflow();
    else this.emit('drain');
  }

  private getCloudWatchGroups = async () => {
    const command = new DescribeLogGroupsCommand({});
    const data = await this.CloudWatchClient.send(command);
    const {logGroups, nextToken} = data;
    if (nextToken) this.nextSequenceToken = nextToken;
    return logGroups ? logGroups.map(logGroup => logGroup.logGroupName) : [];
  };

  private createCloudWatchGroup = async () => {
    const command = new CreateLogGroupCommand({
      logGroupName: CONFIG.logGroupName,
    });

    await this.CloudWatchClient.send(command);
  };

  private getCloudWatchStreams = async () => {
    const command = new DescribeLogStreamsCommand({
      logGroupName: CONFIG.logGroupName,
    });
    const data = await this.CloudWatchClient.send(command);
    const {logStreams} = data;
    const existingStream = logStreams?.find(
      stream => stream.logStreamName === CONFIG.logStreamName
    );
    if (existingStream && existingStream.uploadSequenceToken)
      this.nextSequenceToken = existingStream.uploadSequenceToken;
    return existingStream;
  };

  private createCloudWatchStream = async () => {
    const command = new CreateLogStreamCommand({
      logGroupName: CONFIG.logGroupName,
      logStreamName: CONFIG.logStreamName,
    });

    await this.CloudWatchClient.send(command);
  };

  private writeToCloudWatch = async (logEvents: InputLogEvent[]) => {
    const command = new PutLogEventsCommand({
      logEvents,
      logGroupName: CONFIG.logGroupName,
      logStreamName: CONFIG.logStreamName,
      sequenceToken: this.nextSequenceToken || '',
    });

    if (this.CloudWatchClient) {
      try {
        const response = await this.CloudWatchClient.send(command);
        const {nextSequenceToken} = response;
        if (nextSequenceToken) this.nextSequenceToken = nextSequenceToken;
      } catch (e) {
        if (e instanceof InvalidSequenceTokenException) {
          await this.getCloudWatchStreams();
          await this.writeToCloudWatch(logEvents);
        } else {
          this.emit('error', e);
        }
      }
    }
  };

  private initCloudWatch = async () => {
    try {
      const existingLogGroups = await this.getCloudWatchGroups();
      if (!existingLogGroups.includes(CONFIG.logGroupName))
        await this.createCloudWatchGroup();
      const existingLogStream = await this.getCloudWatchStreams();
      if (!existingLogStream) await this.createCloudWatchStream();
    } catch (e) {
      this.emit('error', e);
    }
  };

  public write = (payload: unknown) => {
    this.emit('write');
    this.queue.push(JSON.stringify(payload));
    this._trySend();
    return this.queue.length !== 0;
  };

  public async end() {
    if (this.queue.length > 0) this.workflow();
    await once(this, 'drain');

    // Delay send so listeners can be setup if need be
    process.nextTick(() => this.emit('close'));
  }
}
