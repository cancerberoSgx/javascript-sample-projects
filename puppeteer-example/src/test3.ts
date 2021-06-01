import * as puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'

const url = 'https://www.psacard.com/pop/basketball-cards/1985/fournier-ases-del-baloncesto/37590';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForResponse(res => {
    return res.url().includes('Pop/GetSetItems')
  }, { timeout: 100000 });
  await page.waitForTimeout(1000);
  const result = await page.$eval('#tablePSA', el => el.outerHTML)
  writeFileSync('tmp_table.html', result)
  await browser.close();
})();
