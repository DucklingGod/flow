import { runMonteCarlo, type MonteCarloInput } from '../domain/scenario'

self.onmessage = (event: MessageEvent<MonteCarloInput>) => {
  self.postMessage(runMonteCarlo(event.data))
}
