import { Worker } from 'worker_threads';
import os from 'os';

const numWorkers = Math.max(2, os.cpus().length - 1);//so a min of 2 and a max of on less than the total cpu cores int the machine
export const workers = [];
//creates a new worker accroding to the traffic_worker
for (let i = 0; i < numWorkers; i++) {
  workers.push(new Worker('./traffic_worker.js'));
}
let nextWorker = 0;
//log: {ip, timestamp, endpoint}
export function sendToWorker(log) {
  workers[nextWorker].postMessage(log);
  nextWorker = (nextWorker + 1) % workers.length;//round robin approach to evenly distribute traffic to each worker
}
