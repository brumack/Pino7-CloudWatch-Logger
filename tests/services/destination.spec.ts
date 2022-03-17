import * as http from 'http';
import {consumeMessage, setupServer} from '../utils/server';
import {Connection} from '../../src/services/destination';

describe('destination', () => {
  let server: http.Server;
  let uri: string;

  beforeAll(() => {
    jest.useFakeTimers();
    [server, uri] = setupServer();
  });

  afterAll(() => {
    server.close();
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a message to our server', async () => {
    const conn = new Connection(uri);

    conn.write('test' as any);

    // Clear out debouncer
    jest.runAllTimers();

    await conn.end();

    expect(consumeMessage).toHaveBeenCalledTimes(1);
  });

  it('only queues up one call within 100ms', async () => {
    const conn = new Connection(uri);

    conn.write('test' as any);
    conn.write('test1' as any);
    conn.write('test2' as any);
    conn.write('test3' as any);
    conn.write('test4' as any);

    // Clear out debouncer
    jest.runAllTimers();

    await conn.end();

    expect(consumeMessage).toHaveBeenCalledTimes(1);
    expect(consumeMessage).toHaveBeenCalledWith([
      'test',
      'test1',
      'test2',
      'test3',
      'test4',
    ]);
  });
});
