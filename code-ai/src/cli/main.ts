import { handleCli } from '.';

(async () => {
  try {
    await handleCli();
  } catch (error) {
    console.log('ERROR', error);
  }
})();
