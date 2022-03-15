describe('Example', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('elements by id and text', async () => {
    await expect(element(by.id('screen-title'))).toBeVisible();
    await expect(element(by.text('Screen 1'))).toBeVisible();
    await expect(element(by.id('screen-button'))).toBeVisible();
    await expect(element(by.text('click me 1'))).toBeVisible();
  });

  it('should show screen 2 after tap', async () => {
    await expect(element(by.text('Screen 1'))).toBeVisible();
    await expect(element(by.text('click me 1'))).toBeVisible();
    await element(by.id('screen-button')).tap();
    await expect(element(by.text('Screen 1'))).not.toBeVisible();
    await expect(element(by.text('click me 1'))).not.toBeVisible();
    await expect(element(by.text('Screen 2'))).toBeVisible();
    await expect(element(by.text('click me 2'))).toBeVisible();
  });

  xit('shouldnt be visible & swipe', async () => {
    await expect(element(by.text('bottom text'))).not.toBeVisible();
    element(by.text('Placeholder')).scroll(800, 'down')
    await expect(element(by.text('bottom text'))).toBeVisible();

  })

});
