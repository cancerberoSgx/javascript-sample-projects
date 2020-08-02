import axios from 'axios'
import {baseUrl} from './config'
describe('1', ()=>{
  it('1', async ()=>{
    const response = await axios.get(`${baseUrl}/v1/search`)
    console.log(response.data);
    
    // expect(1).toBe(2)
  })
})