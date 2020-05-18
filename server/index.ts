import { Server } from './server';

if (!process.env['DEBUG']) {
  console.debug = function() {};
}

new Server(1235).run();
