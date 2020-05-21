export const state: State = {
  magnificationFactor: 10.0,
  limit: 50,
  translateXFactor: 1.0 / 1.6,
  translateYFactor: 1.0 / 2.0,
  animate: false,
  magnificationFactorStep: 1.5,
};

export interface State {
  magnificationFactorStep: number;
  magnificationFactor: number;
  limit: number;
  translateXFactor: number;
  translateYFactor: number;
  animate: boolean;
}
