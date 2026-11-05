/**
 * Minimal ambient types for d3-force-3d.
 * Only the surface Choir actually uses.
 */
declare module "d3-force-3d" {
  export interface SimulationNode {
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number;
    fy?: number;
    fz?: number;
    index?: number;
  }

  export interface Simulation<N extends SimulationNode, L> {
    alpha(a?: number): Simulation<N, L>;
    alphaDecay(d?: number): Simulation<N, L>;
    velocityDecay(v?: number): Simulation<N, L>;
    force(name: string, force?: unknown): Simulation<N, L>;
    nodes(nodes?: N[]): Simulation<N, L> | N[];
    tick(iters?: number): Simulation<N, L>;
    stop(): Simulation<N, L>;
    on(event: string, cb: (...args: unknown[]) => void): Simulation<N, L>;
  }

  export function forceSimulation<N extends SimulationNode>(
    nodes?: N[],
    numDimensions?: 1 | 2 | 3
  ): Simulation<N, undefined>;

  export interface Force {
    strength(s?: number | ((d: unknown, i: number) => number)): Force;
    distanceMax(d?: number): Force;
    distanceMin(d?: number): Force;
    x(x?: number): Force;
    y(y?: number): Force;
    z(z?: number): Force;
  }
  export function forceManyBody(): Force;
  export function forceCenter(x?: number, y?: number, z?: number): Force;
  export function forceLink<N extends SimulationNode, L>(links?: L[]): Force;
  export function forceCollide<N extends SimulationNode>(radius?: number | ((d: N, i: number) => number)): Force;
}
