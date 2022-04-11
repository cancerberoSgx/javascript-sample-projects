import axios from 'axios';

(async ()=>{
  try {
    const r = await axios.get('https://api.prod.cloud.findmotto.com/version', {timeout: 4000})    
    console.log(r.status, r.data);
  } catch (error) {
    console.error(error);
  }
})();