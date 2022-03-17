import * as http from 'http';
import {Worker} from 'worker_threads';
import {resolve} from 'path';
import {consumeMessage, setupServer} from './utils/server';
import {once} from 'events';

describe('Big-Brother-Client integration', () => {
  let server: http.Server;
  let uri: string;

  beforeAll(() => {
    [server, uri] = setupServer();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends all logs before exit', async () => {
    // must result in more than 80kb of payload
    // or test will fail
    const logs = 1000;
    const bb = new Worker(resolve(__dirname, './utils/client.js'), {
      workerData: {uri, logs},
    });
    await once(bb, 'exit');
    const calls = consumeMessage.mock.calls;

    // Make sure logs where not all sent at once
    expect(calls.length).toBeGreaterThan(1);

    // Make sure every log wasn't sent by itself
    expect(calls.length).toBeLessThan(logs);

    // Make sure all logs where received before exiting
    expect(
      calls.reduce<number>(
        (acc: number, curr: unknown[][]) => acc + curr[0].length,
        0
      )
    ).toEqual(logs);
  });
});
