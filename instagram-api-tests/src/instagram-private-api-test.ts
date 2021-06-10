import { IgApiClient } from 'instagram-private-api';
const ig = new IgApiClient();
// You must generate device id's before login.
// Id's generated based on seed
// So if you pass the same value as first argument - the same id's are generated every time
ig.state.generateDevice(process.env.IG_USERNAME);
// // Optionally you can setup proxy url
// ig.state.proxyUrl = process.env.IG_PROXY;
(async () => {
  // Execute all requests prior to authorization in the real Android application
  // Not required but recommended
  // await ig.simulate.preLoginFlow();
  const loggedInUser = await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
  // The same as preLoginFlow()
  // Optionally wrap it to process.nextTick so we dont need to wait ending of this bunch of requests
  // process.nextTick(async () => await ig.simulate.postLoginFlow());
  // Create UserFeed instance to get loggedInUser's posts
  
  // search for a user which is not on my network (Neymar) (by user name)
  const searchResults = await ig.user.searchExact('neymarjr')
  // writeFileSync('tmp_searchResults.json', JSON.stringify(searchResults, null, 2))
  
  const userFeed = ig.feed.user(searchResults.pk);
  const postsFirstPage = await userFeed.items();
  console.log(postsFirstPage.filter(post=>post.image_versions2).map(post=>post.image_versions2.candidates.map(c=>c.url)[0]).flat())
  
  // All the feeds are auto-paginated, so you just need to call .items() sequentially to get next page
  const postsSecondPage = await userFeed.items();
  console.log(postsSecondPage.filter(post=>post.image_versions2).map(post=>post.image_versions2.candidates.map(c=>c.url)[0]).flat())
})();
