import { clearText, expectElement, enter, wait, expectNotExist, expectClick } from '../testUtil';
import * as to from '../toHave/toHave'
export const c = to

const TIMEOUT = 15000
describe('elements explorer', () => {

  beforeAll(async () => {
    page.setDefaultNavigationTimeout(TIMEOUT)
    jest.setTimeout(TIMEOUT)
    await page.setViewport({width: 1300, height: 900})
    await page.goto('http://localhost:8080/');
    await wait(500)
  });

  it('should show Elements explorer by default', async () => {
    await page.waitFor('.section')
    await page.waitFor('#editorContainer')
    await expect(page).toHave({
      selector:'.elements.is-active',
      text: 'Elements',
    })
  })

  it('should should show editor on one side', async () => {
    await expect(page).toHave({
      selector: '#editorContainer',
      text: 'function',
      verb: 'toContain',
      extractAs: 'innerText'
    })
    // await expectElement(page, '#editorContainer', 'function')
  })

  it('explorer example should render more than two elements', async () => {
    // await page.waitForSelector('.ElementExplorer .media-content .nodeTag')
    // await page.waitForSelector('.ElementExplorer .test-show-all-info')
    await expect(page).toHave({
      selector: '.ElementExplorer .media-content .nodeTag',
      matchElementCount: n=>n>2,
      waitFor: true
    })
    await page.screenshot({ path: './tmp/01-explorer1.png' })    
  })

  it('explorer should not render details by default and render a show-all-info el', async () => {
    await expect(page).toHave({
      selector: '.ElementExplorer .test-attribute-name',
      matchElementCount: n=>n==0
    })    
    await expect(page).toHave({
      selector: '.ElementExplorer .test-show-all-info',
      matchElementCount: n=>n===1,
      waitFor: true
    })
    await page.screenshot({ path: './tmp/01-explorer1.png' })
  })
    
    it('show-all-info button that shows more than 1 attribute when clicked ', async () => {
    await expect(page).not.toHave({
      selector: '.ElementExplorer .test-attribute-name',
    })
    await page.click('.ElementExplorer .test-show-all-info')
    await wait(500)
    await expect(page).toHave({
      selector: '.ElementExplorer .test-attribute-name',
      matchElementCount: n=>n>1,
      waitFor: true
    })
    await page.screenshot({ path: './tmp/01-explorer2.png' })

  })

  it('should clear text and error should report when that happens', async () => {
    await expect(page).not.toHave({
      selector: '.ElementExplorer .error-name',
    })
    await clearText(page, '#editorContainer')
    await expect(page).toHave({
      selector: '.ElementExplorer .error-name',
      matchElementCount: n=>n===1,
      text: 'SyntaxError', 
      waitFor: true
    })
    // await wait(500)
    await page.screenshot({ path: './tmp/02-clear.png' })
    // await expectNotExist(page, '.explorer .media-content em')
  })



  it('should enter new code and error should hide if core is correct and show correct tag name amount', async () => {
    await expect(page).not.toHave({
      selector: '.ElementExplorer .media-content .nodeTag',
    })
    await enter(page, '#editorContainer', `
import {JSXAlone} from './index'
function fooBarTest4() {
  return <div><p>Hello</p>world</div>
}
`, true)
    await expectElement(page, '#editorContainer', 'fooBarTest4')
    await page.screenshot({ path: './tmp/03-newCode2.png' })

    await expect(page).not.toHave({  
      selector: '.ElementExplorer .error-name',
      waitFor: true
    })

    await expect(page).toHave({  
      selector: '.ElementExplorer .media-content .nodeTag',
      waitFor:true,
      text: 'div'
      // matchElementCount: n=>n===2,// TODO: fails because it finds 4 not 2
    })
    await page.screenshot({ path: './tmp/03-newCode2.png' })

  }) 


    // await page.q('.ElementExplorer .media-content .nodeTag')
    
  //   await expectNotExist(page, '.ElementExplorer .media-content em', 'className')    
  //   await page.click('.ElementExplorer .test-show-all-info')
  //   await wait(500)
  //   await page.waitForSelector('.ElementExplorer .media-content .nodeTag')

  //   await page.screenshot({ path: './tmp/01-explorer2.png' })
  //   await expectElement(page, '.ElementExplorer .media-content em', 'className')
  //   await page.screenshot({ path: './tmp/01-explorer3.png' })
  // })

  // it('should wait until explorer renders', async () => {
  //   await page.screenshot({ path: './tmp/01-explorer1.png' })
  //   await page.waitForSelector('.explorer .media-content .nodeTag')
  //   await page.waitForSelector('.explorer .test-show-all-info')
    
  //   await expectNotExist(page, '.explorer .media-content em', 'className')    
  //   await page.click('.explorer .test-show-all-info')
  //   await wait(500)
  //   await expectElement(page, '.explorer .media-content em', 'className')
  //   await page.screenshot({ path: './tmp/01-explorer2.png' })
  //   // await page.screenshot({ path: './tmp/01-explorer3.png' })
  // })



//   it('should show html output', async () => {
//     await page.screenshot({ path: './tmp/04-outputHtml1.png' })
//     await expect(page).toHave({
//       selector:'.editorExplorerBodyMember.elements .explorer>.button',
//       text: 'output html', 
//       caseInsensitive: true
//     })

//     await expectClick(page, '.editorExplorerBodyMember.elements .explorer>.button', 'output html')
//     await wait(500)
//     await page.screenshot({ path: './tmp/04-outputHtml2.png' })

//     await expect(page).toHave({
//       selector:'#getHtmlCodeModalContent .html-code-container.html-code',
//       text: `&lt;p&gt;Hello
//       &lt;/p&gt;
//           `,
//           asCode: true,
//       caseInsensitive: true,
//     })
//     await expect(page).toHave({
//       selector:'#getHtmlCodeModalContent .html-code-container.html',
//       text: 'html',
//           asCode: true,
//       caseInsensitive: true
//     })
//     await expect(page).toClick('#getHtmlCodeModalContent .html>a  ')

//     await expect(page).toHave({
//       selector: '#getHtmlCodeModalContent .html-code-container.html',
//       text: `<p>HELLO      </p>`,
//       caseInsensitive: true,
//       asCode: true,
//       extractAs: 'outerHTML',
//     })
//     await page.screenshot({ path: './tmp/06-outputHtml3.png' })
    
//   })
})
