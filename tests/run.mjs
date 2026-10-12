import { run as runSimTests } from './sim.test.mjs';
import { run as runStressTests } from './stress.test.mjs';
import { run as runNetTests } from './net.test.mjs';

runSimTests();
runStressTests();
runNetTests();

console.log('PASS');
