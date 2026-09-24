import { WorkerRpc } from '../lib/workerRpc.ts'

let rpc: WorkerRpc | undefined

/** Lazily spawns the shared ML worker (and respawns it if it crashed, e.g. out of memory). */
export function mlWorker(): WorkerRpc {
  if (rpc?.dead) rpc = undefined
  rpc ??= new WorkerRpc(new Worker(new URL('./ml.worker.ts', import.meta.url), { type: 'module' }))
  return rpc
}
