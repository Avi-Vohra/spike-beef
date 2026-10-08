import { run as runSimTests } from './sim.test.mjs';
import { run as runNetTests } from './net.test.mjs';

runSimTests();
runNetTests();

console.log('PASS');
