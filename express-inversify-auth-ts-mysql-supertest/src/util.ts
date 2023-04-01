export const isTestEnv = () =>
  !process.env.NODE_ENV || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'local';

export const isLocalTestEnv = () => !process.env.NODE_ENV || process.env.NODE_ENV === 'local';
