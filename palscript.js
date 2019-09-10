const puppeteer = require('puppeteer');
const request = require('request-promise-native');
const poll = require('promise-poller').default;
const apiKey = '' //2captcha api key

const { get_items } = require('./helper.js');
const user = require('./user.js');
console.log(user);

const chromeOptions = {
  headless:false,
  slowMo:10,
  defaultViewport: null};

(async () => {

  const browser = await puppeteer.launch(chromeOptions)
  const page = await browser.newPage()
  const navigationPromise = page.waitForNavigation()

  const items = get_items();
    for (const item of items) {

        await page.goto(item.url)

        await page.setViewport({ width: 1440, height: 747 })

        await scrollToBottom(page)
        await page.waitFor(500);
        await scrollToBottom(page)
        await page.waitFor(500);
        await scrollToBottom(page)
        await page.waitFor(500);
        const [h3] = await page.$x("//h3[contains(.,\'" + item.keyPhrase + "\')]");
        if (h3) {
          await h3.click();
        }

        if(item.size !== "") {
          // dropdown with each size
          await page.waitFor(700);

          await page.type("select#product-select", item.size)
        }

        await page.click('.add')
        await page.waitFor(700);
        await page.waitForSelector('.cart-heading')
        await page.click('.cart-heading')
  }

  //cart to checkout
  await page.goto('https://shop-usa.palaceskateboards.com/cart')

  await page.waitForSelector('#cartform > #basket-right > .checkbox-wrapper > label > .checkbox-control')
  await page.click('#cartform > #basket-right > .checkbox-wrapper > label > .checkbox-control')

  await page.waitFor(500);

  await page.waitForSelector('#content > #shopping-cart > #cartform #checkout')
  await page.click('#content > #shopping-cart > #cartform #checkout')
  console.log('clicked checkout')
  await navigationPromise
  console.log('passed nav promise')
  //checkout page
  //business for captcha below

  await page.waitFor(1000);
  console.log('1000 ms')
  console.log('before const')
  const currentURL = page.url();
  console.log('page url caught')
  const requestId = await initiateCaptchaRequest(apiKey,currentURL);
  console.log('after const')



  //await page.waitForNavigation({ waitUntil: 'load' })
  console.log('load')
  await page.waitForSelector('#checkout_email')
  console.log('waited for #checkout_email')
	element = await page.$x(`//*[@id="checkout_email"]`);
	await element[0].click();
  console.log('clicked email')


	element = await page.$x(`//*[@id="checkout_email"]`);
	await element[0].type(user.email);


  console.log('typed email')

	element = await page.$x(`(.//*[normalize-space(text()) and normalize-space(.)='Email'])[1]/following::label[1]`);
	await element[0].click();

	element = await page.$x(`//*[@id="checkout_shipping_address_first_name"]`);
	await element[0].click();

	element = await page.$x(`//*[@id="checkout_shipping_address_first_name"]`);
	await element[0].type(user.firstName);

	element = await page.$x(`//*[@id="checkout_shipping_address_last_name"]`);
	await element[0].click();

	element = await page.$x(`//*[@id="checkout_shipping_address_last_name"]`);
	await element[0].type(user.lastName);

	element = await page.$x(`//*[@id="checkout_shipping_address_address1"]`);
	await element[0].click();

	element = await page.$x(`//*[@id="checkout_shipping_address_address1"]`);
	await element[0].type(user.address);

	element = await page.$x(`//*[@id="checkout_shipping_address_city"]`);
	await element[0].type(user.city);

  await page.type("select#checkout_shipping_address_province", "Tennessee")

	element = await page.$x(`//*[@id="checkout_shipping_address_zip"]`);
	await element[0].type(user.zip);

	element = await page.$x(`//*[@id="checkout_shipping_address_phone"]`);
	await element[0].type(user.phone);

  const response = await pollForRequestResults(apiKey, requestId);
  await page.evaluate(`document.getElementById("g-recaptcha-response").innerHTML="${response}";`);

  //finish up shipping info
  element = await page.$x(`//*[@class="btn__content"]`);
	await element[0].click();

  //confirm shipping page?
  await page.waitForSelector('.step__footer__continue-btn')
  await page.click('.step__footer__continue-btn')

  //pay page
  await page.waitFor(500);
  await page.reload({ waitUntil: ["networkidle2", "domcontentloaded"] });
  await page.waitFor(500);

  //paypal obvi
  element = await page.$x(`//img[@alt='PayPal']`);
	await element[0].click();

  //seeya
  await page.waitForSelector('.edit_checkout > .step__footer > .shown-if-js > .step__footer__continue-btn > .btn__content')
  await page.click('.edit_checkout > .step__footer > .shown-if-js > .step__footer__continue-btn > .btn__content')

  await navigationPromise


})()



//-----bottom scroller function-----

async function scrollToBottom(page) {
  const distance = 746; // should be less than or equal to window.innerHeight
  const delay = 120;
  while (await page.evaluate(() => document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight)) {
    await page.evaluate((y) => { document.scrollingElement.scrollBy(0, y); }, distance);
    await page.waitFor(delay);
  }
}


//-----captcha business-----
async function initiateCaptchaRequest(apiKey,currentURL) {
  const formData = {
    method: 'userrecaptcha',
    key: apiKey, // your 2Captcha API Key
    googlekey: '6LeoeSkTAAAAAA9rkZs5oS82l69OEYjKRZAiKdaF', //palaces captcha api key, i did the work for you
    pageurl: currentURL,
    json: 1
  };
  const response = await request.post('http://2captcha.com/in.php', {form: formData});
  return JSON.parse(response).request;
}

async function pollForRequestResults(key, id, retries = 30, interval = 1500, delay = 10000) {
  await timeout(delay);
  return poll({
    taskFn: requestCaptchaResults(key, id),
    interval,
    retries
  });
}

function requestCaptchaResults(apiKey, requestId) {
  const url = `http://2captcha.com/res.php?key=${apiKey}&action=get&id=${requestId}&json=1`;
  return async function() {
    return new Promise(async function(resolve, reject){
      const rawResponse = await request.get(url);
      const resp = JSON.parse(rawResponse);
      if (resp.status === 0) return reject(resp.request);
      resolve(resp.request);
    });
  }
}

const timeout = millis => new Promise(resolve => setTimeout(resolve, millis))
