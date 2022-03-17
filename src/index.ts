import 'dotenv/config';
import express from 'express';
import {CloudWatchLogger} from './lib/CloudWatchLogger';

const app = express();
const logger = new CloudWatchLogger({appName: 'Logger'});

app.get('/', (req, res) => {
  if (req.query) {
    Object.entries(req.query).forEach(pair => {
      logger.info(`${pair[0]}: ${pair[1]}`);
    });
  }
  res.send();
});

app.listen(3000, () => console.log('Listening...'));
