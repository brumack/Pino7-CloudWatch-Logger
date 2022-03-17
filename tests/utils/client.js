const {once} = require('events');
const {workerData} = require('worker_threads');
const {BigBrother} = require('../../dist');

process.nextTick(async () => {
  const bb = new BigBrother({
    appName: 'lklasdhalf',
    uri: workerData.uri,
  });

  await once(bb, 'ready');

  for (let i = 0; i < workerData.logs; i++) {
    bb.info('test' + i);
  }

  // eslint-disable-next-line no-process-exit
  process.exit(0);
});
