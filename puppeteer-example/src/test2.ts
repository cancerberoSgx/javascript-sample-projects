import * as puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'

const url = 'https://www.psacard.com/pop/basketball-cards/1985/fournier-ases-del-baloncesto/37590';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await waitFor(async ()=>{
    return (await page.$eval('#tablePSA', el => el.outerHTML.length)) > 2000
  })
  const result = await page.$eval('#tablePSA', el => el.outerHTML)
  writeFileSync('tmp_table.html', result)
  await browser.close();
})();

async function waitFor(predicate) {
  return new Promise(resolve=>{
    const timer = setInterval(async ()=>{
      const result = await predicate()
      if(result) {
        clearInterval(timer)
        resolve(result)
      }
    }, 1000)
  })
}