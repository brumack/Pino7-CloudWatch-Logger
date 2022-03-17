const build = require('pino-abstract-transport');
const {once} = require('events');
// eslint-disable-next-line node/no-missing-require
const {Connection} = require('./destination');

module.exports = async function (opts) {
  const destination = new Connection(opts.uri);
  await once(destination, 'ready');

  return build(
    async source => {
      for await (const obj of source) {
        const toDrain = !destination.write(obj);

        if (toDrain) {
          await once(destination, 'drain');
        }
      }
    },
    {
      async close() {
        await destination.end();
        await once(destination, 'close');
      },
    }
  );
};
