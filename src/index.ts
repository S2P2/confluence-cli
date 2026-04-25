import { createProgram } from './cli';

const program = createProgram();

if (process.argv.length <= 2) {
  program.help({ error: false });
}

program.parse(process.argv);
