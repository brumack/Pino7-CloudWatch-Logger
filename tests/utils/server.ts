import * as http from 'http';

export const consumeMessage = jest.fn((..._args) => {});

export function setupServer(): [http.Server, string] {
  const requestListener = function (
    req: http.IncomingMessage,
    res: http.ServerResponse
  ) {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      consumeMessage(JSON.parse(Buffer.concat(chunks).toString()));

      res.writeHead(200);
      res.end();

      server.emit('responded');
    });
  };

  const app = http.createServer(requestListener);
  const server = app.listen(0);
  let uri: string;

  const address = server.address();
  if (typeof address === 'string') {
    uri = address;
  } else {
    if (address?.family === 'IPv4')
      uri = `http://${address?.address}:${address?.port}`;
    else uri = `http://[${address?.address}]:${address?.port}`;
  }

  return [server, uri];
}
